import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {_electron}=await import(pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href);
const {version}=JSON.parse(await readFile('package.json','utf8'));
const profile=path.resolve('desktop-test-profile','name-'+Date.now());await mkdir(profile,{recursive:true});
const options={executablePath:path.resolve(`dist/${version}/Magic-win32-x64/Magic.exe`),args:['--test-hidden'],env:{...process.env,MAGIC_TEST_PROFILE:profile}};
let app=await _electron.launch(options);
try {
  let page=await app.firstWindow();await page.waitForSelector('.node');
  await page.evaluate(()=>{window.namingBubbles=[];for(const type of ['keydown','keyup','keypress'])document.addEventListener(type,e=>{if(e.target.id==='project-name')window.namingBubbles.push(type+':'+e.key);});});
  const input=page.locator('#project-name');await input.fill('');await input.pressSequentially('My Creative Workspace');
  assert.equal(await input.inputValue(),'My Creative Workspace');assert.ok(await input.evaluate(e=>e===document.activeElement));
  await input.press('Enter');assert.ok(await input.evaluate(e=>e!==document.activeElement));
  await input.fill('Discard this edit');await input.press('Escape');assert.equal(await input.inputValue(),'My Creative Workspace');
  await input.focus();await input.press('Control+A');await page.keyboard.insertText('Pasted Multi Word Title');
  await page.locator('#search').click();assert.equal(await input.inputValue(),'Pasted Multi Word Title');
  await input.focus();await input.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));});
  assert.ok(await input.evaluate(e=>e===document.activeElement));
  await input.evaluate(e=>{e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true}));e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});
  assert.ok(await input.evaluate(e=>e===document.activeElement));
  await input.press('End');await page.keyboard.insertText(' 日本語');await input.press('Enter');
  assert.deepEqual(await page.evaluate(()=>window.namingBubbles),[]);
  await page.waitForTimeout(500);await app.close();app=await _electron.launch(options);page=await app.firstWindow();await page.waitForSelector('.node');
  assert.equal(await page.locator('#project-name').inputValue(),'Pasted Multi Word Title 日本語');
  console.log('Workspace title passed: spaces, Enter, Escape, blur, inserted text, composition guard, keyboard isolation, close/reopen persistence.');
}finally{await app.close();}
