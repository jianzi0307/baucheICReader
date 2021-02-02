/**
 * 点易拍高拍仪工具类
 *  - 身份证相关功能
 */
class BaucheIcReader {
  constructor(options) {
    // 是否自动读卡
    this.autoMode = options.autoMode || false
    // IE: domID 用于挂载activeX控件
    this.elId = options.elId || 'activeX'
    // 非IE: websocket服务ip地址
    this.wsIp = options.wsIp || 'localhost'
    this.wsAddress = `ws://${this.wsIp}:9002`
    // websocket实例
    this.ws = null
    // 正在重连
    this.reconnecting = false
    // 是否IE浏览器
    this.isIE = false
    // 身份证信息
    this.idCard = null
    // 身份证属性映射表
    this.idCardAttrMap = {
      '9': 'name', '10': 'ic', '11': 'sex', '12': 'nation', '13': 'birthday',
      '14': 'address', '15': 'signdEpt', '16': 'validStartDate', '17': 'validEndDate',
      '18': 'samid', '19': 'photo'
    }
    // 初始化
    this.loadActiveX()
  }

  // 浏览器检测，启用不同的连接方式
  loadActiveX() {
    const { elId } = this
    // IE浏览器使用ActiveX控件
    if (navigator.userAgent.indexOf('MSIE') >= 0) {
      this.isIE = true
      document.getElementById(elId).innerHTML =
        '<OBJECT id="axCam_Ocx" classid="clsid:D5BD5B4A-4FC0-4869-880B-27EE9869D706" width="1px" height="1px" ></OBJECT>'
    } else {
      // 非IE使用WebSocket
      this.isIE = false
      if (!window.WebSocket) {
        alert('WebSocket not supported by this browser!')
      }
      this.wsInitIp()
    }
  }

  // websocket
  wsInitIp() {
    if (this.ws && this.ws.readyState === 1) {
      this.wsDisconnect()
    }
    try {
      window.WebSocket = window.WebSocket || window.MozWebSocket
      if (!window.WebSocket) {
        console.log('WebSocket not supported by this browser');
        return
      }
      this.ws = new WebSocket(this.wsAddress);
      this.ws.binaryType = 'arraybuffer'
      this.listenEvents()
    } catch (err) {
      this.wsReconnect()
    }
  }

  // 监听
  listenEvents() {
    // ws连接成功
    this.ws.onopen = (event) => {
      this.startIc()
    }
    this.ws.onmessage = this.onMessage
    // ws连接异常需要重连
    this.ws.onerror = (event) => {
      console.log('websocket connect error.')
      this.wsReconnect()
    }
    // 被动关闭
    this.ws.onclose = (event) => {
      this.wsDisconnect()
    }
  }

  // ws监听
  onMessage(event) {
    const aDataArray = new Uint8Array(event.data)
    if (aDataArray.length === 0) return
    // 解构
    const [byte0, byte1, byte2, byte3, byte4, byte5] = aDataArray
    if (byte0 != 0xef) return
    switch (byte1) {
      // 身份证信息
      case 0x23:
        // byte4: len byte3: type
        const data = new Uint8Array(byte4)
        for (let i = 0; i < byte4; i++) {
          data[i] = aDataArray[5 + i]
        }
        this.handleMessage(byte3, decodeURIComponent(byteToString(data)))
        break;
      // 身份证照片
      case 0x3e:
        const len = byte3 * 65536 + byte4 * 256 + byte5
        const baseDataArray = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          baseDataArray[i] = aDataArray[6 + i]
        }
        const str = byteToString(baseDataArray)
        this.handleMessage(19, decodeURIComponent(str))
        break;
      // case 0x71:
      //   const len = byte4 * 256 + byte5
      //   const data = new Uint8Array(len)
      //   for (let i = 0; i < len; i++) {
      //     data[i] = aDataArray[6 + i]
      //   }
      //   const str = byteToString(data)
      //   const text = decodeURIComponent(str)
      //   this.handleMessage(byte3, text)
      //   break;
    }
  }

  // 简单的重连机制: 没连接上会一直重连
  wsReconnect() {
    if (this.reconnecting) return
    this.reconnecting = true
    this.timer = setTimeout(() => {
      console.log('attempting to reconnect...')
      this.wsInitIp()
      this.reconnecting = false
      clearTimeout(this.timer)
    }, 5000);
  }

  // ws主动断开连接
  wsDisconnect() {
    if (this.ws.readyState === 1) {
      this.ws.close()
      this.ws = null
    }
  }

  // 处理身份证信息
  handleMessage(type, msg) {
    const key = this.idCardAttrMap[type.toString()]
    if (!this.idCard) {
      this.idCard = {}
    }
    this.idCard[key] = msg
  }

  // 启动身份证模块功能
  startIc() {
    if (this.isIE) {
      axCam_Ocx.StartIDCard()
      this.autoMode && this.startAutoReadIc()
    } else {
      this.autoMode && this.wsSendMsgStartIC()
    }
  }

  // WS方式身份证模块功能自动读卡
  wsSendMsgStartIC() {
    const aDataArray = new Uint8Array(4)
    aDataArray[0] = 0xef
    aDataArray[1] = 0x3c
    aDataArray[2] = 0x01
    aDataArray[3] = 0x00
    this.ws.send(aDataArray.buffer)
  }

  // WS方式手动启动身份证模块功能
  wsSendMsgGetOneIC() {
    const aDataArray = new Uint8Array(4);
    aDataArray[0] = 0xef;
    aDataArray[1] = 0x3c;
    aDataArray[2] = 0x01;
    aDataArray[3] = 0x01;
    this.ws.send(aDataArray.buffer);
  }

  // WS方式关闭身份证自动读卡
  wsSendMsgStopWorkIC() {
    const aDataArray = new Uint8Array(4);
    aDataArray[0] = 0xef;
    aDataArray[1] = 0x41;
    aDataArray[2] = 0x01;
    aDataArray[3] = 0x00;
    this.ws.send(aDataArray.buffer);
  }

  // WS方式读取身份证信息
  wsSendMsgGetICValues(type) {
    const aDataArray = new Uint8Array(4);
    aDataArray[0] = 0xef;
    aDataArray[1] = 0x3d;
    aDataArray[2] = 0x01;
    aDataArray[3] = type;
    this.ws.send(aDataArray.buffer);
  }

  // 启动身份证自动读卡
  startAutoReadIc() {
    if (this.isIE) {
      const ret = axCam_Ocx.WorkIDCard(1);
      if (ret == 0) {
        console.log('0x20 启动身份证自动读卡')
      } else if (ret == -2) {
        console.log('0x1f 未启动身份证功能')
      } else if (ret == -3) {
        console.log('0x1e 未发现模块')
      }
    } else {
      this.wsSendMsgStartIC();
    }
  }

  // 启动身份证手动读卡
  startManualReadIc() {
    if (this.isIE) {
      const ret = axCam_Ocx.GetOneIC();
      if (ret == 0) {
        console.log('0x1b 身份证读卡成功')
      } else if (ret == -1) {
        console.log('0x1d 重新操作')
      } else if (ret == -2) {
        console.log('0x1c 身份证读卡失败')
      } else if (ret == -3) {
        console.log('0x1e 未发现模块')
      } else if (ret == -4) {
        console.log('0x1f 未启动身份证功能')
      }
    } else {
      this.wsSendMsgGetOneIC();
    }
  }

  // 关闭身份证自动读卡
  stopAutoReadIc() {
    if (this.isIE) {
      var ret = axCam_Ocx.WorkIDCard(0);
      if (ret == 0) {
        console.log('0x21 关闭身份证自动读卡')
      } else if (ret == -2) {
        console.log('0x1f 未启动身份证功能')
      } else if (ret == -3) {
        console.log('0x1e 未发现模块')
      }
    } else {
      this.wsSendMsgStopWorkIC();
    }
  }

  // 读取身份证信息
  readIcInfo() {
    if (this.isIE) {
      // 获取姓名
      const name = axCam_Ocx.GetICValues("NAME")
      if (name.length > 0) {
        if (!this.idCard) {
          this.idCard = {}
        }
        // 姓名
        this.idCard.name = name
        // 身份证号
        this.idCard.ic = axCam_Ocx.GetICValues("IC")
        // 性别
        this.idCard.sex = axCam_Ocx.GetICValues("SEX")
        // 民族
        this.idCard.nation = axCam_Ocx.GetICValues("NATION")
        // 生日
        this.idCard.birthday = axCam_Ocx.GetICValues("BIRTHDAY")
        // 地址
        this.idCard.address = axCam_Ocx.GetICValues("ADDRESS")
        // 签发机关
        this.idCard.signdEpt = axCam_Ocx.GetICValues("SIGNDEPT")
        // 有效期开始日期
        this.idCard.validStartDate = axCam_Ocx.GetICValues("VALIDSTARTDATE")
        // 有效期截止日期
        this.idCard.validEndDate = axCam_Ocx.GetICValues("VALIDENDDATE")
        // 安全模块号
        this.idCard.samid = axCam_Ocx.GetICValues("SAMID")
        // 照片base64信息 不包含"data:;base64,"
        this.idCard.photo = axCam_Ocx.GetICPicture()
      }
    } else {
      for (let i = 0; i < 11; i++) {
        this.wsSendMsgGetICValues(i);
      }
    }
  }

  // 获取身份证信息
  getIcInfo() {
    return this.idCard
  }
}

export default BaucheIcReader

