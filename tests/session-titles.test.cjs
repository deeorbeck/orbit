const {test}=require('node:test');const assert=require('node:assert/strict');const {sessionTitle}=require('../src/session-titles.cjs');
test('tab names follow folders and clean Codex session titles',()=>{
 assert.equal(sessionTitle({cwd:'/Users/test/project'}),'project');
 assert.equal(sessionTitle({cwd:'C:\\work\\project'}),'project');
 assert.equal(sessionTitle({cwd:'/work/project'},'test@host:~/project'),'project');
 assert.equal(sessionTitle({cwd:'/work'},'⠹ My conversation | project'),'My conversation');
 assert.equal(sessionTitle({cwd:'/work'},'[ ! ] Action Required | My conversation | project'),'My conversation');
 assert.equal(sessionTitle({cwd:'/work',title:'My saved conversation | project'}),'My saved conversation');
 assert.equal(sessionTitle({cwd:'/work',serverId:'ssh-x',label:'Production'}),'Production');
});
