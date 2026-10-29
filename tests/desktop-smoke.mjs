import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {_electron}=await import(process.env.MAGIC_PLAYWRIGHT_PATH?pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href:'playwright');
const profile=path.resolve('desktop-test-profile','run-'+Date.now());await mkdir(profile,{recursive:true});
const {version}=JSON.parse(await readFile('package.json','utf8'));
const options={executablePath:path.resolve(`dist/${version}/Magic-win32-x64/Magic.exe`),args:['--test-hidden'],env:{...process.env,MAGIC_TEST_PROFILE:profile}};
let app=await _electron.launch(options);let page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.node');assert.ok(page.url().startsWith('magic://app/'));
await page.locator('#new-project').click();await page.locator('#project-name').fill('Desktop persistence');await page.locator('#project-name').press('Tab');
await page.locator('[data-tool="shape"]').click();const box=await page.locator('#viewport').boundingBox();await page.mouse.move(box.x+180,box.y+180);await page.mouse.down();await page.mouse.move(box.x+400,box.y+330);await page.mouse.up();await page.locator('.node').dblclick({position:{x:80,y:60}});await page.waitForSelector('.vector-overlay');await page.locator('#finish-vector').click();await page.waitForTimeout(500);await app.close();
app=await _electron.launch(options);page=await app.firstWindow();await page.waitForSelector('.node');assert.equal(await page.locator('#project-name').inputValue(),'Desktop persistence');assert.equal(await page.locator('.node').count(),1);assert.equal(await page.locator('#export-panel').count(),1);await app.close();assert.deepEqual(errors,[]);console.log('Packaged desktop passed: own protocol, vector interaction, close/reopen persistence, branded interface, export panel.');

