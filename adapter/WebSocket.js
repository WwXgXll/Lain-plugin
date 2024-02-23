import express from 'express'
import fs from 'fs'
import { createServer } from 'http'
import fetch from 'node-fetch'
import common from '../lib/common/common.js'
import Cfg from '../lib/config/config.js'
import ComWeChat from './WeChat/index.js'
import shamrock from './shamrock/index.js'
import LagrangeCore from './LagrangeCore/index.js'

class WebSocket {
  constructor () {
    this.port = Cfg.port
    this.path = {
      '/Shamrock': shamrock,
      '/ComWeChat': ComWeChat,
      '/LagrangeCore': LagrangeCore
    }
  }

  /** run! */
  start () {
    this.server()
  }

  async server () {
    /** 保存监听器返回 */
    lain.echo = new Map()
    /** 主动请求后得到的响应 */
    lain.echo = new Map()
    /** 微信登录 */
    Bot.lain.loginMap = new Map()
    /** 临时文件 */
    lain.Files = new Map()
    /** 创建Express应用程序 */
    const app = express()
    /** 创建HTTP服务器 */
    this.Server = createServer(app)

    /** 设置静态文件服务 */
    app.use('/api/File', express.static(process.cwd() + '/temp/FileToUrl'))

    /** 解除端口占用api */
    app.get('/api/close-server', async (req, res) => {
      const ip = req.ip
      if (ip !== '::1' && ip !== '127.0.0.1') return res.status(401).json({ error: '未经授权的访问' })

      try {
        res.json({ message: '正在关闭当前服务器...' })
        this.Server.close(() => {
          logger.warn('[Lain-plugin] 服务器在另外一处启动，正在关闭当前服务器...')
        })
      } catch (error) {
        logger.error(error)
        res.status(500).json({ error: '关闭服务器时出错' })
      }
    })

    /** QQBotApi */
    app.get('/api/File/:token', async (req, res) => {
      const { ip } = req
      const token = req.params.token
      const filePath = process.cwd() + '/temp/FileToUrl/' + req.params.token
      /** 收到日志 */
      logger.mark('[GET请求] ' + logger.blue(`[${token}] ->[${req.get('host')}] ->[${ip}]`))

      try {
        /** 读 */
        const File = lain.Files.get(filePath)

        /** 缓存有 */
        if (File) {
          // res.setHeader('Content-Type', File.mime)
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader('Content-Disposition', 'inline')
          logger.mark('[发送文件] ' + logger.blue(`[${token}] => [${File.md5}] => [${ip}]`))
          fs.createReadStream(filePath).pipe(res)
        } else {
          res.status(410).json({ status: 'failed', message: '资源过期' })
          logger.mark('[请求返回] ' + logger.blue(`[${token}] => [文件已过期] => [${ip}]`))
        }
      } catch (error) {
        res.status(500).json({ status: 'failed', message: '哎呀，报错了捏' })
        logger.mark('[请求返回] ' + logger.blue(`[${token}] => [服务器内部错误] => [${ip}]`))
        logger.error(error)
      }
    })

    /** 将WebSocket服务器实例与HTTP服务器关联 */
    this.Server.on('upgrade', (request, socket, head) => {
      const pathname = request.url
      if (!this.path[pathname]) {
        logger.error(`未知连接，已拒绝连接：${request.url}`)
        return socket.destroy()
      }

      this.path[pathname].handleUpgrade(request, socket, head, (socket) => {
        this.path[pathname].emit('connection', socket, request)
      })
    })

    this.Server.listen(this.port, async () => this.log())

    /** 捕获错误 */
    this.Server.on('error', async (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`[Lain-plugin] 端口${this.port}已被占用，正在尝试解除`)
        try {
          const response = await fetch(`http://localhost:${this.port}/api/close-server`)
          if (response.ok) {
            await common.sleep(5000)
            this.log()
          } else {
            throw new Error(`HTTP请求失败，状态码: ${response.status}`)
          }
        } catch (error) {
          logger.error(error)
        }
      } else {
        logger.error(error)
      }
    })
  }

  /** 打印启动日志 */
  log () {
    logger.info('Lain-plugin', `HTTP服务器：${logger.blue(`http://localhost:${this.port}`)}`)
    /** 转为数组对象，循环打印 */
    Object.entries(this.path).forEach(([key, value]) => {
      logger.info('Lain-plugin', `本地 ${key.replace('/', '')} 连接地址：${logger.blue(`ws://localhost:${this.port}${key}`)}`)
    })
  }
}

export default new WebSocket()
