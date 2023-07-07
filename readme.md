# MarsBot
## Telegram 频道查重 Bot

![image](https://github.com/MicroCBer/MarsBot/assets/66859419/dc0e6fbb-7706-4e8b-b90f-0a078501eb26)

### 倡导和平有爱共处，反对建政开盒互怼

### 安装
1. Clone 仓库
2. 安装 Node.js
3. 安装 Yarn：`npm i -g yarn`
4. 安装库文件(在项目文件夹内)：`yarn`

### 配置
1. ~~OCR_KEYS: 在 https://ocr.space/OCRAPI 注册，并填入运行文件夹下（一般就在项目文件夹下）的 `OCR_KEYS` 文件内，每行一个，支持负载均衡。~~ 已改为使用 PearOCR（AntOCR） 本地识别
2. 登录 SelfBot：打开命令行，输入 `yarn start`，按提示登录

### 运行（保活）

打开命令行，输入 `yarn run keep`
