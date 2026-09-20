import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
const docs = [{title:'Dragon record',kind:'Recap part',href:'/sessions/session-9/#scene-sbeef',text:'Dragon dragon dragon.'}];
const version = createHash('sha256').update(JSON.stringify(docs)).digest('hex');
test.beforeEach(async ({page}) => {
 await page.route('https://**', r=>r.abort());
 await page.route('**/search-index.json', r=>r.fulfill({json:docs}));
 await page.route('**/api/ask', r=>r.fulfill({json:{answer:'A recorded dragon.',sources:docs.map(({text,...s})=>s),corpusVersion:version}}));
 await page.goto('/');
});
async function open(page: Page) { await page.locator('[data-search-open]:visible').first().click(); await expect(page.getByRole('combobox')).toBeFocused(); }
test('saved Q&A restores only explicitly and forgetting removes it', async ({page})=> {
 let calls = 0; page.on('request', request => { if(request.url().endsWith('/api/ask')) calls++; });
 await open(page); await page.getByRole('combobox').fill('dragon');
 await page.locator('#search-ask').getByRole('button',{name:/Ask the chronicle/}).click();
 await page.getByRole('button',{name:'Save answer in this tab'}).click();
 await page.getByRole('button',{name:'Close search'}).click();
 await page.goto('/campaign/');
 await open(page); await expect(page.getByRole('combobox')).toHaveValue('');
 await expect(page.locator('.ask-answer')).toHaveCount(0);
 await page.getByRole('button',{name:'Restore saved answer'}).click();
 await expect(page.getByRole('combobox')).toHaveValue('dragon');
 expect(calls).toBe(1);
 await expect(page.locator('.ask-answer')).toHaveText('A recorded dragon.');
 await page.getByRole('combobox').fill('a different question');
 await expect(page.locator('.ask-answer')).toHaveCount(0);
 await page.getByRole('button',{name:'Forget saved answer'}).click();
 expect(await page.evaluate(()=>sessionStorage.getItem('icespire-saved-answer'))).toBeNull();
});
test('corpus changes clear a saved answer before it can be restored', async ({page})=> {
 await open(page); await page.getByRole('combobox').fill('dragon');
 await page.locator('#search-ask').getByRole('button',{name:/Ask the chronicle/}).click();
 await page.getByRole('button',{name:'Save answer in this tab'}).click();
 await page.getByRole('button',{name:'Close search'}).click();
 await page.route('**/search-index.json',r=>r.fulfill({json:[{...docs[0],text:'Changed dragon record.'}]}));
 await open(page);
 await expect(page.getByText('The saved answer was cleared because the chronicle changed or the record was invalid.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Restore saved answer'})).toHaveCount(0);
});
test('explicit cancel prevents a late answer replacing the new offer',async({page})=> {
 let finish!: () => void; const held = new Promise<void>(resolve=>finish=resolve);
 await page.route('**/api/ask',async r=>{await held; await r.fulfill({json:{answer:'Late answer',sources:[]}}).catch(()=>{});});
 await open(page); await page.getByRole('combobox').fill('dragon');
 await page.locator('#search-ask').getByRole('button',{name:/Ask the chronicle/}).click();
 await page.getByRole('button',{name:'Cancel question'}).click(); finish();
 await expect(page.locator('#search-ask').getByRole('button',{name:/Ask the chronicle/})).toBeVisible();
 await expect(page.locator('.ask-answer')).toHaveCount(0);
});
test('recap jump links and profile part links share published anchors',async({page})=> {
 await page.goto('/sessions/session-9/');
 const nav=page.getByRole('navigation',{name:'Jump within this recap'});
 const href=await nav.getByRole('link').nth(1).getAttribute('href');
 await nav.getByRole('link').nth(1).click();
 await expect(page.locator(href!)).toBeInViewport();
 await page.goto('/characters/dax/');
 const part=page.locator('.recap-mentions a[href*="#scene-"]').first();
 const target=await part.getAttribute('href');
 await part.focus(); await part.press('Enter');
 await expect(page).toHaveURL(new RegExp(target!.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
});

test('blocked answer storage preserves ordinary Ask and reports save failure', async ({page})=> {
 await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
 await page.reload(); await open(page); await page.getByRole('combobox').fill('dragon');
 await page.locator('#search-ask').getByRole('button',{name:/Ask the chronicle/}).click();
 await page.getByRole('button',{name:'Save answer in this tab'}).click();
 await expect(page.getByText('This browser cannot save answers in this tab.')).toBeVisible();
 await expect(page.locator('.ask-answer')).toHaveText('A recorded dragon.');
});
