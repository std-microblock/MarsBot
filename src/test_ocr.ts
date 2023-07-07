import puppeteer from 'puppeteer';
import { RequestInterceptionManager } from 'puppeteer-intercept-and-modify-requests'

(async () => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    const client = await page.target().createCDPSession()
    const interceptManager = new RequestInterceptionManager(client as any);

    await interceptManager.intercept(
        {
            urlPattern: `https://pearocr.com/js/668.*.js`,
            resourceType: 'Script',
            modifyResponse({ body }) {
                setTimeout(() => {
                    interceptManager.disable()
                }, 100)
                return {
                    body: body?.replace(/\,(\S+)\.addImage\=/, ',window.antOcr=$1,$1.addImage='),
                }
            },
        }
    )

    await page.goto('https://pearocr.com/#/');

    page.evaluate(`const _refreshItemText = antOcr.refreshItemText

    const recognize = (img)=>{
        return Promise.race([new Promise((rs)=>{
            antOcr.deleteAll();
            antOcr.addImage(img);
            
            antOcr.refreshItemText = (e)=>{
                _refreshItemText(e);
                rs(antOcr.RecoDataList[0].detail.map(v=>v.text).join('\n'));
            }
        }),new Promise((_,rj)=>setTimeout(rj,5000,'timeout'))])
    }`);
})();