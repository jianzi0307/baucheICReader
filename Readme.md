## 点易拍高拍仪身份证读取

```javascript
const icReader = new BaucheIcReader({
    autoMode: false
})
// 手动读卡
icReader.startManualReadIc()

icReader.readIcInfo()
const icInfo = icReader.getIcInfo()
```
