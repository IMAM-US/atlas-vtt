"""Unit tests for authoring data and prompt compilation, not image quality."""
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
module_spec = importlib.util.spec_from_file_location('map_spec', ROOT / 'scripts/map_spec.py')
m = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(m)
REGIONAL = m.load_json(ROOT/'examples/regional-atlas.map.json')
BATTLE = m.load_json(ROOT/'examples/tactical-mill.map.json')
NIGHT = m.load_json(ROOT/'examples/regional-night.patch.json')
RESPONSE_SCHEMA = m.load_json(ROOT/'schemas/response.schema.json')
REGISTRY = Registry().with_resource(m.SCHEMA['$id'],Resource.from_contents(m.SCHEMA))
RESPONSE_VALIDATOR = Draft202012Validator(RESPONSE_SCHEMA,registry=REGISTRY)


class MapSpecTests(unittest.TestCase):
    def setUp(self):
        self.regional = copy.deepcopy(REGIONAL)
        self.battle = copy.deepcopy(BATTLE)

    def assertInvalid(self,spec,fragment):
        errors,_=m.validate_spec(spec)
        self.assertTrue(errors)
        self.assertIn(fragment,' '.join(errors))

    def test_regional_valid(self):
        self.assertEqual(m.validate_spec(self.regional)[0],[])

    def test_battle_valid(self):
        self.assertEqual(m.validate_spec(self.battle)[0],[])

    def test_deterministic_compilation(self):
        self.assertEqual(m.compile_spec(self.regional),m.compile_spec(self.regional))

    def test_compilation_ignores_object_key_order(self):
        reordered=copy.deepcopy(self.regional)
        reordered['entities']=dict(reversed(list(reordered['entities'].items())))
        reordered['style']['palette']=dict(reversed(list(reordered['style']['palette'].items())))
        self.assertEqual(m.compile_spec(reordered),m.compile_spec(self.regional))

    def test_hash_ignores_key_order(self):
        reverse=dict(reversed(list(self.regional.items())))
        self.assertEqual(m.canonical_hash(reverse),m.canonical_hash(self.regional))

    def test_hash_changes_with_source(self):
        h=m.canonical_hash(self.regional)
        self.regional['environment']['time_of_day']='night'
        self.assertNotEqual(h,m.canonical_hash(self.regional))

    def test_response_schema(self):
        result=m.envelope(self.regional,m.compile_spec(self.regional))
        RESPONSE_VALIDATOR.validate(result)
        self.assertEqual(result['map_spec'],self.regional)

    def test_discovery_schema(self):
        RESPONSE_VALIDATOR.validate(m.load_json(ROOT/'examples/discovery.response.json'))

    def test_player_omits_secret_entities(self):
        result=m.compile_spec(self.regional,'player')
        text=m.dump(result)
        self.assertNotIn('sealed_observatory',text)
        self.assertNotIn('Sealed Observatory',text)
        self.assertNotIn('green dial',text)
        self.assertNotIn('secret_stair',text)
        self.assertNotIn('SEALED OBSERVATORY',text)

    def test_gm_lore_separate_from_image_instructions(self):
        result=m.compile_spec(self.regional,'gm')
        self.assertIn('Sealed Observatory',result['image_instructions'])
        self.assertNotIn('green dial',result['image_instructions'])
        self.assertIn('green dial',result['private_gm_notes']['sealed_observatory'])

    def test_overlay_not_painted_by_default(self):
        result=m.compile_spec(self.regional)
        self.assertIn('Do not paint a square grid, hex grid',result['image_instructions'])
        self.assertIn('Do not paint any titles',result['image_instructions'])
        self.assertGreater(len(result['postproduction']['labels']),0)

    def test_baked_labels_are_included(self):
        self.regional['annotations']['label_mode']='baked'
        result=m.compile_spec(self.regional)
        self.assertIn('"CROWN OF TIDES"',result['image_instructions'])
        self.assertTrue(any('labels require' in x for x in result['warnings']))

    def test_image_not_claimed(self):
        result=m.compile_spec(self.battle)
        self.assertEqual(result['image_status'],'not_generated')
        self.assertEqual(result['validation']['image_review'],'not_run')
        self.assertEqual(result['postproduction']['status'],'plan_only_not_exported')

    def test_night_patch_preserves_geometry(self):
        result=m.patch_spec(self.regional,NIGHT)
        self.assertEqual(result['revision'],2)
        self.assertEqual(result['production']['variant'],'moonlit')
        self.assertEqual(result['entities'],self.regional['entities'])
        self.assertEqual(result['connections'],self.regional['connections'])
        self.assertEqual(self.regional,REGIONAL)
        self.assertTrue(any('fresh generation' in x for x in m.compile_spec(result)['warnings']))

    def test_stale_revision_rejected(self):
        patch=copy.deepcopy(NIGHT);patch[0]['value']=9
        with self.assertRaises(ValueError):m.patch_spec(self.regional,patch)

    def test_revision_test_required(self):
        with self.assertRaises(ValueError):m.patch_spec(self.regional,NIGHT[1:])

    def test_locked_value_rejected(self):
        patch=[{'op':'test','path':'/revision','value':1},{'op':'replace','path':'/entities/citadel/placement/bounds/0','value':0.44}]
        with self.assertRaisesRegex(ValueError,'Locked field'):m.patch_spec(self.regional,patch)

    def test_explicit_locked_override(self):
        patch=[{'op':'test','path':'/revision','value':1},{'op':'replace','path':'/entities/citadel/placement/bounds/0','value':0.44}]
        result=m.patch_spec(self.regional,patch,['/entities/citadel/placement'])
        self.assertEqual(result['entities']['citadel']['placement']['bounds'][0],0.44)
        self.assertEqual(result['locks'],self.regional['locks'])

    def test_patch_cannot_remove_locks(self):
        patch=[{'op':'test','path':'/revision','value':1},{'op':'replace','path':'/locks','value':[]}]
        with self.assertRaisesRegex(ValueError,'cannot change /locks'):m.patch_spec(self.regional,patch)

    def test_invalid_patch_type(self):
        with self.assertRaisesRegex(ValueError,'Invalid patch'):m.patch_spec(self.regional,['bad'])

    def test_unknown_property_rejected(self):
        self.regional['fictional_image_seed']=1234
        self.assertInvalid(self.regional,'Additional properties')

    def test_invalid_bounds(self):
        self.regional['entities']['citadel']['placement']['bounds']=[0.95,0.16,0.22,0.2]
        self.assertInvalid(self.regional,'outside the canvas')

    def test_entity_path_must_fit(self):
        self.regional['entities']['river']['placement']['path'][0]=[0.99,0.01]
        self.assertInvalid(self.regional,'path point lies outside')

    def test_unknown_entity_reference(self):
        self.regional['connections']['spire_ascent']['to']='missing'
        self.assertInvalid(self.regional,'unknown entity ID missing')

    def test_aspect_ratio_mismatch(self):
        self.regional['canvas']['aspect_ratio']=[4,3]
        self.assertInvalid(self.regional,'aspect_ratio')

    def test_square_arithmetic(self):
        self.battle['gameplay']['grid']['pixels_per_cell']=90
        self.assertInvalid(self.battle,'grid dimensions do not match')

    def test_hex_not_square_arithmetic(self):
        self.assertEqual(m.validate_spec(self.regional)[0],[])
        self.assertTrue(any('Hex dimensions' in w for w in m.validate_spec(self.regional)[1]))

    def test_tactical_view(self):
        self.battle['style']['perspective']='illustrated_oblique'
        self.assertInvalid(self.battle,'orthographic_top_down')

    def test_disconnected_objective(self):
        del self.battle['connections']['door_to_interior']
        self.assertInvalid(self.battle,'unreachable')

    def test_route_too_narrow(self):
        self.battle['connections']['bridge_approach']['width_cells']=1
        self.assertInvalid(self.battle,'smaller than gameplay minimum')

    def test_cardinal_conflict(self):
        self.regional['relationships'][0]['relation']='south_of'
        self.assertInvalid(self.regional,'conflicts with declared bounds')

    def test_hidden_public_route(self):
        self.regional['connections']['secret_stair']['visibility']='public'
        self.assertInvalid(self.regional,'visible route references')

    def test_hidden_public_label(self):
        self.regional['annotations']['labels'][-1]['visibility']='public'
        self.assertInvalid(self.regional,'visible label exposes')

    def test_edit_requires_base_and_scope(self):
        self.regional['production']['action']='edit_existing'
        self.assertInvalid(self.regional,'base_image_reference')

    def test_edit_lists_required_attachment(self):
        self.regional['production'].update(action='edit_existing',base_image_reference='approved-base.png',edit_scope=['Change daylight to moonlight only.'])
        result=m.compile_spec(self.regional)
        self.assertIn('EDIT ONLY THE APPROVED BASE',result['image_instructions'])
        self.assertEqual(result['attachments_required'][0]['source'],'approved-base.png')
        self.assertEqual(result['image_status'],'not_generated')

    def test_reference_image_is_attachment_requirement(self):
        self.regional['inspiration']['references'][0].update(kind='image',source='reference.png')
        self.assertIn({'source':'reference.png','role':'style'},m.compile_spec(self.regional)['attachments_required'])

    def test_duplicate_keys_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'bad.json';path.write_text('{"a":1,"a":2}')
            with self.assertRaisesRegex(ValueError,'Duplicate JSON key'):m.load_json(path)

    def test_nan_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'bad.json';path.write_text('{"a":NaN}')
            with self.assertRaisesRegex(ValueError,'Not valid JSON'):m.load_json(path)

    def test_patch_array_operations_and_escaping(self):
        value={'a/b':{'~x':[1,2]}}
        ops=[{'op':'test','path':'/a~1b/~0x/0','value':1},
             {'op':'add','path':'/a~1b/~0x/-','value':3},
             {'op':'replace','path':'/a~1b/~0x/1','value':7},
             {'op':'remove','path':'/a~1b/~0x/0'}]
        self.assertEqual(m.apply_patch(value,ops),{'a/b':{'~x':[7,3]}})
        self.assertEqual(value,{'a/b':{'~x':[1,2]}})

    def test_boolean_not_number_in_patch_test(self):
        with self.assertRaisesRegex(ValueError,'test failed'):
            m.apply_patch({'a':True},[{'op':'test','path':'/a','value':1}])

    def test_inplace_cli_disabled(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'map.json';path.write_text(m.dump(self.regional))
            before=path.read_bytes()
            result=subprocess.run([sys.executable,str(ROOT/'scripts/map_spec.py'),'compile',str(path),'-o',str(path)],capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            self.assertIn('in-place overwrites are disabled',result.stderr)
            self.assertEqual(before,path.read_bytes())

    def test_response_schema_rejects_unknown_fields(self):
        response=m.envelope(self.regional,m.compile_spec(self.regional));response['extra']='bad'
        self.assertFalse(RESPONSE_VALIDATOR.is_valid(response))

if __name__=='__main__':
    unittest.main(verbosity=2)
