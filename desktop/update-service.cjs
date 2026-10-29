const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const REPOSITORY = 'realchasecurtis/magic';
function newer(version, current) {
  if (![version,current].every(v=>/^\d+\.\d+\.\d+$/.test(v))) throw Error('Invalid release version.');
  const a=version.split('.').map(Number),b=current.split('.').map(Number);
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
function selectRelease(release,current) {
  const version=String(release.tag_name).replace(/^v/,'');
  if(release.draft || release.prerelease || !newer(version,current)) return {status:'current',version};
  const name=`Magic-Setup-${version}.exe`;
  const asset=release.assets?.find(a=>a.name===name);
  const checksum=release.assets?.find(a=>a.name===name+'.sha256');
  const prefix=`https://github.com/${REPOSITORY}/releases/download/${release.tag_name}/`;
  for(const item of [asset,checksum]) if(!item || item.browser_download_url!==prefix+item.name) throw Error('This release has no verified Windows installer.');
  if(!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>1024*1024*1024) throw Error('Invalid installer size.');
  return {status:'available',version,name,size:asset.size,url:asset.browser_download_url,checksumURL:checksum.browser_download_url};
}
function createUpdater({fetch,current,downloadDirectory,reveal}) {
  let approved=null,busy=false;
  async function request(url,maxBytes) {
    const response=await fetch(url,{signal:AbortSignal.timeout(300000),headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok) throw Error(`Download failed (${response.status}).`);
    const reader=response.body.getReader(),chunks=[];let size=0;
    try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('Download exceeds expected size.');chunks.push(Buffer.from(value));}}
    finally {await reader.cancel().catch(()=>{});}
    return Buffer.concat(chunks);
  }
  return {
    async check() {
      if(busy)throw Error('Please wait for the download to finish.');
      approved=null;
      const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json'}});
      if(response.status===404)return {status:'unpublished'};
      if(!response.ok)throw Error(`Update check failed (${response.status}).`);
      const result=selectRelease(await response.json(),current);
      if(result.status==='available')approved=result;
      return {status:result.status,version:result.version};
    },
    async download() {
      if(!approved||busy)throw Error('Check for updates before downloading.');
      busy=true;let temporary;
      try {
        const release=approved;
        const checksum=(await request(release.checksumURL,1024)).toString('utf8').trim();
        const expected=checksum.match(/^([a-fA-F0-9]{64})(?:\s+\*?([^\r\n]+))?$/);
        if(!expected || (expected[2]&&expected[2]!==release.name))throw Error('Invalid installer checksum.');
        const bytes=await request(release.url,release.size);
        if(bytes.length!==release.size||bytes.subarray(0,2).toString()!=='MZ'||crypto.createHash('sha256').update(bytes).digest('hex')!==expected[1].toLowerCase())throw Error('Installer verification failed.');
        await fs.mkdir(downloadDirectory,{recursive:true});
        temporary=await fs.mkdtemp(path.join(downloadDirectory,'Magic-update-'));
        const destination=path.join(temporary,release.name);
        await fs.writeFile(destination,bytes,{flag:'wx'});
        await fs.writeFile(destination+':Zone.Identifier','[ZoneTransfer]\r\nZoneId=3\r\nHostUrl='+release.url+'\r\n');
        await reveal(destination);temporary=null;
        return {name:release.name};
      } finally {busy=false;if(temporary)await fs.rm(temporary,{recursive:true,force:true});}
    }
  };
}
module.exports={newer,selectRelease,createUpdater,REPOSITORY};
