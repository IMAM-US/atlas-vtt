const { execFileSync, spawnSync } = require('child_process');
const os = require('os');

function getCandidateBinaryPaths(homeDir = os.homedir()) {
  return [
    `${homeDir}/.local/bin/obsidian`,
    `${homeDir}/Applications/Obsidian.app/Contents/MacOS/Obsidian`,
    '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
  ];
}

function commandExists(command) {
  try {
    execFileSync('/bin/zsh', ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function isExecutable(candidate) {
  try {
    execFileSync('/bin/test', ['-x', candidate], { stdio: 'ignore' });
    return true;
  } catch (_error) {
    return false;
  }
}

function resolveObsidianCliBinary(deps = {}) {
  const env = deps.env || process.env;
  const executableCheck = deps.isExecutable || isExecutable;
  const commandCheck = deps.commandExists || commandExists;
  const homeDir = env.HOME || os.homedir();

  if (env.OBSIDIAN_CLI_BIN && executableCheck(env.OBSIDIAN_CLI_BIN)) {
    return env.OBSIDIAN_CLI_BIN;
  }

  for (const candidate of getCandidateBinaryPaths(homeDir)) {
    if (executableCheck(candidate)) {
      return candidate;
    }
  }

  if (commandCheck('obsidian')) {
    return 'obsidian';
  }

  if (commandCheck('Obsidian')) {
    return 'Obsidian';
  }

  throw new Error(
    "Unable to locate the Obsidian CLI binary. Set OBSIDIAN_CLI_BIN, install the obsidian shim in ~/.local/bin, or install Obsidian in ~/Applications or /Applications."
  );
}

function isVaultArg(arg) {
  return typeof arg === 'string' && arg.startsWith('vault=');
}

/**
 * The binary reads `vault=` only as its first argument; after the command it
 * answers "Vault not found.". So the vault goes first however it is given: a
 * literal `vault=` anywhere in the call, else the vault option.
 */
function buildObsidianArgs(command, args = [], vault = null) {
  const tokens = [command, ...args];
  const vaultArgs = tokens.filter(isVaultArg);
  if (vaultArgs.length > 1) {
    throw new Error(`Name one vault, not ${vaultArgs.length}: ${vaultArgs.join(' ')}`);
  }

  const target = vaultArgs[0] || (vault ? `vault=${vault}` : null);
  const rest = tokens.filter((arg) => !isVaultArg(arg));
  return target ? [target, ...rest] : rest;
}

function parseWrapperArgs(argv, env = process.env) {
  const options = {
    obsidianBin: env.OBSIDIAN_CLI_BIN || null,
    vault: env.OBSIDIAN_CLI_VAULT || null,
    command: null,
    args: [],
    help: false,
    printBin: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    const next = argv[index + 1];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    if (token === '--print-bin') {
      options.printBin = true;
      continue;
    }

    if (token === '--obsidian-bin' && next) {
      options.obsidianBin = next;
      index += 1;
      continue;
    }
    if (token.startsWith('--obsidian-bin=')) {
      options.obsidianBin = token.slice('--obsidian-bin='.length);
      continue;
    }

    if (token === '--vault' && next) {
      options.vault = next;
      index += 1;
      continue;
    }
    if (token.startsWith('--vault=')) {
      options.vault = token.slice('--vault='.length);
      continue;
    }

    if (!options.command && !isVaultArg(token)) {
      options.command = token;
      continue;
    }

    options.args.push(token);
  }

  return options;
}

function runObsidianCliCommand(command, args = [], deps = {}) {
  const env = deps.env || process.env;
  const binary =
    deps.obsidianBin ||
    resolveObsidianCliBinary({
      env: {
        ...env,
        ...(deps.obsidianBin ? { OBSIDIAN_CLI_BIN: deps.obsidianBin } : {}),
      },
      isExecutable: deps.isExecutable,
      commandExists: deps.commandExists,
    });

  const finalArgs = buildObsidianArgs(command, args, deps.vault || env.OBSIDIAN_CLI_VAULT || null);

  const result = spawnSync(binary, finalArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Forward stderr whatever the outcome, so nothing the binary reports is lost.
  if (result.stderr) {
    (deps.stderr || process.stderr).write(result.stderr);
  }

  // A spawn error (ENOENT, or ENOBUFS once output passes maxBuffer) keeps its code.
  if (result.error || result.status !== 0) {
    const error = result.error || new Error(`${binary} exited with ${result.signal || result.status}`);
    Object.assign(error, {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    throw error;
  }

  return result.stdout;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/obsidian-cli.js [options] <command> [command-args]',
      '',
      'Wrapper options:',
      '  --vault <name>          Target a specific vault (sent as vault=<name> before the command)',
      '  --obsidian-bin <path>   Explicit path to the Obsidian CLI binary',
      '  --print-bin             Print the resolved CLI binary path and exit',
      '  --help                  Show this message',
      '',
      'Examples:',
      '  node scripts/obsidian-cli.js help',
      '  node scripts/obsidian-cli.js --vault test-vault plugin:reload id=atlas-vtt',
      '  node scripts/obsidian-cli.js --vault test-vault dev:errors',
      '  node scripts/obsidian-cli.js vault=test-vault eval code="app.vault.getFiles().length"',
      '',
      'What the binary returns:',
      '  eval prints "=> " followed by the result, for example "=> 42".',
      '  A slow eval can still be running when the call returns, so empty output does',
      '  not show that the code failed. Have the code write what it reads to a file.',
      '  A refused call can still exit 0 (for example "Vault not found.").',
      '  The binary\'s stderr is passed through, also when it succeeds.',
      '',
    ].join('\n')
  );
}

function main() {
  const options = parseWrapperArgs(process.argv.slice(2));
  if (options.help || (!options.printBin && !options.command)) {
    printHelp();
    return;
  }

  const obsidianBin =
    options.obsidianBin ||
    resolveObsidianCliBinary({
      env: {
        ...process.env,
        ...(options.obsidianBin ? { OBSIDIAN_CLI_BIN: options.obsidianBin } : {}),
      },
    });

  if (options.printBin) {
    process.stdout.write(`${obsidianBin}\n`);
    return;
  }

  const stdout = runObsidianCliCommand(options.command, options.args, {
    obsidianBin,
    vault: options.vault,
  });

  if (stdout) {
    process.stdout.write(stdout);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildObsidianArgs,
  commandExists,
  getCandidateBinaryPaths,
  isExecutable,
  parseWrapperArgs,
  resolveObsidianCliBinary,
  runObsidianCliCommand,
};
