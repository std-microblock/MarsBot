# MarsBot
## Telegram 频道查重 Bot


#### 纯 phash

![image](https://github.com/MicroCBer/MarsBot/assets/66859419/dc0e6fbb-7706-4e8b-b90f-0a078501eb26)

#### OCR + AI 字符串表意匹配

![image](https://github.com/MicroCBer/MarsBot/assets/66859419/9424e3c8-c3d2-485b-9811-c9e947503a3c)

#### OpenCV 特征提取匹配

![image](https://github.com/MicroCBer/MarsBot/assets/66859419/3793c6d0-290b-40a9-a827-bd0793019f68)



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
