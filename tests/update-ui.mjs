import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {_electron}=await import(process.env.MAGIC_PLAYWRIGHT_PATH?pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href:'playwright');
const profile=path.resolve('desktop-test-profile','updates-'+Date.now());await mkdir(profile,{recursive:true});
const {version}=JSON.parse(await readFile('package.json','utf8'));
const app=await _electron.launch({executablePath:path.resolve(`dist/${version}/Magic-win32-x64/Magic.exe`),args:['--test-hidden'],env:{...process.env,MAGIC_TEST_PROFILE:profile}});
try {
  const page=await app.firstWindow();await page.waitForSelector('.node');
  await app.evaluate(({net})=>{net.fetch=async()=>({status:200,ok:true,json:async()=>({tag_name:'v0.10.2',assets:[{name:'Magic-Setup-0.10.2.exe',size:100,browser_download_url:'https://github.com/realchasecurtis/magic/releases/download/v0.10.2/Magic-Setup-0.10.2.exe'},{name:'Magic-Setup-0.10.2.exe.sha256',browser_download_url:'https://github.com/realchasecurtis/magic/releases/download/v0.10.2/Magic-Setup-0.10.2.exe.sha256'}]})});});
  await page.locator('#updates').click();await page.locator('#check-release').click();await page.locator('#download-release').waitFor();
  assert.equal(await page.locator('#download-release').textContent(),'Download Latest Update');
  assert.match(await page.locator('#update-status').textContent(),/0.10.2/);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#download-release').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('#check-release').click();assert.equal(await page.locator('#download-release').count(),1);
  console.log('Packaged update UI passed: manual check, newer-release download button, no duplicate buttons, reduced motion.');
}finally{await app.close();}
