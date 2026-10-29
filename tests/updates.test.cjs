const {test}=require('node:test');
const assert=require('node:assert/strict');
const {newer,selectRelease,createUpdater,REPOSITORY}=require('../desktop/update-service.cjs');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const bytes=Buffer.from('MZ test installer');
function fixture(){const name='Magic-Setup-0.10.2.exe',prefix=`https://github.com/${REPOSITORY}/releases/download/v0.10.2/`;return {tag_name:'v0.10.2',assets:[{name,size:bytes.length,browser_download_url:prefix+name},{name:name+'.sha256',browser_download_url:prefix+name+'.sha256'}]};}
test('semantic versions and exact official installer selection',()=>{
  assert.ok(newer('0.10.1','0.9.9'));assert.ok(!newer('0.9.9','0.10.1'));
  assert.equal(selectRelease(fixture(),'0.10.1').status,'available');
  assert.equal(selectRelease(fixture(),'0.10.2').status,'current');
  const bad=fixture();bad.assets[0].browser_download_url='https://example.com/evil.exe';assert.throws(()=>selectRelease(bad,'0.10.1'));
  assert.throws(()=>selectRelease({...fixture(),tag_name:'latest'},'0.10.1'));
  assert.throws(()=>selectRelease({...fixture(),assets:[]},'0.10.1'));
});
test('manual download verifies hash, marks origin, reveals without execution',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'magic-update-test-'));let revealed;
  try {
    const fetch=async url=>url.endsWith('/latest')?new Response(JSON.stringify(fixture())):url.endsWith('.sha256')?new Response(crypto.createHash('sha256').update(bytes).digest('hex')+'  Magic-Setup-0.10.2.exe'):new Response(bytes);
    const updater=createUpdater({fetch,current:'0.10.1',downloadDirectory:directory,reveal:p=>revealed=p});
    await assert.rejects(updater.download());assert.equal((await updater.check()).status,'available');assert.equal(revealed,undefined);
    await updater.download();assert.deepEqual(await fs.readFile(revealed),bytes);assert.match(await fs.readFile(revealed+':Zone.Identifier','utf8'),/ZoneId=3/);
    const invalid=createUpdater({fetch:async url=>url.endsWith('/latest')?new Response(JSON.stringify(fixture())):url.endsWith('.sha256')?new Response('0'.repeat(64)):new Response(bytes),current:'0.10.1',downloadDirectory:directory,reveal:()=>assert.fail('Invalid installer revealed')});
    await invalid.check();await assert.rejects(invalid.download(),/verification/);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
