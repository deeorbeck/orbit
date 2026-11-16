const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inputAction}=require('../src/input-shortcuts.cjs');
const key=(name,mods={})=>({type:'keyDown',key:name,...mods});
test('Ctrl+Tab is intercepted with terminal focus and shell editing keys remain untouched',()=>{
 for(const platform of ['darwin','win32','linux']){
  assert.equal(inputAction(key('Tab',{control:true}),platform),'next');
  assert.equal(inputAction(key('Tab',{control:true,shift:true}),platform),'previous');
  assert.equal(inputAction(key('Tab'),platform),null);
  for(const name of ['c','d','z'])assert.equal(inputAction(key(name,{control:true}),platform),null);
 }
 assert.equal(inputAction(key('w',{control:true}),'linux'),null);
 assert.equal(inputAction(key('w',{meta:true}),'darwin'),'close');
 assert.equal(inputAction(key('w',{meta:true,shift:true}),'darwin'),'closeTab');
 assert.equal(inputAction(key('w',{meta:true,alt:true,shift:true}),'darwin'),'closeWindow');
 assert.equal(inputAction(key('q',{meta:true}),'darwin'),null);
});
