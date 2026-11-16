const { test } = require('node:test');
const assert = require('node:assert/strict');
const { adjacentPane } = require('../src/pane-navigation.cjs');
test('directional navigation follows nested split geometry and stays put at edges', () => {
 const panes = [{id:'left',left:0,right:250,top:0,bottom:700},{id:'top',left:255,right:510,top:0,bottom:315},{id:'bottom',left:255,right:510,top:320,bottom:700},{id:'right',left:515,right:1030,top:0,bottom:700}];
 for (const [from, direction, expected] of [['bottom','up','top'],['top','down','bottom'],['bottom','left','left'],['bottom','right','right'],['left','left',null],['top','up',null],['right','down',null]]) assert.equal(adjacentPane(panes,from,direction),expected);
});
