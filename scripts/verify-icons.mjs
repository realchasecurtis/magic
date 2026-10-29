import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {NtExecutable,NtExecutableResource,Resource}=await import(process.env.MAGIC_RESEDIT_MODULE?pathToFileURL(process.env.MAGIC_RESEDIT_MODULE).href:'resedit');
const ico=fs.readFileSync('assets/magic.ico'),expected=[];
for(let i=0;i<ico.readUInt16LE(4);i++){
  const offset=6+i*16,start=ico.readUInt32LE(offset+12);
  expected.push(ico.subarray(start,start+ico.readUInt32LE(offset+8)));
}
assert.equal(expected.length,7);
for(const file of process.argv.slice(2)){
  const resources=NtExecutableResource.from(NtExecutable.from(fs.readFileSync(file)));
  const groups=Resource.IconGroupEntry.fromEntries(resources.entries);
  const matching=groups.filter(group=>{
    const entries=group.icons.map(icon=>Buffer.from(resources.entries.find(e=>e.type===3&&e.id===icon.iconID&&e.lang===group.lang).bin));
    return entries.length===expected.length&&expected.every(frame=>entries.some(entry=>entry.equals(frame)));
  });
  assert.ok(matching.length>0,`${file}: missing complete Magic icon group`);
  console.log(`${file}: all seven Magic icon resolutions match the source ICO`);
}
