// DO NOT MOVE THIS FILE
// This file must be in the same folder as the main.dev.js
// otherwise packing for npm breaks the path for the zen node
// @flow
import path from 'path'

import compare from 'semver-compare'
import _ from 'lodash'
import { ipcMain, dialog } from 'electron'
import spwanZenNodeChildProcess from '@zen/zen-node'

import { shout } from './utils/dev'
import { formatChainForZenNode } from './utils/helpers'
import db from './services/db'
import { ZEN_NODE_VERSION, WALLET_VERSION } from './constants/versions'

export const IPC_ZEN_NODE_NON_ZERO_EXIT = 'zenNodeNonZeroExit'
export const IPC_ASK_IF_WIPED_DUE_TO_VERSION = 'askIfWipedDueToVersion'
export const IPC_ANSWER_IF_WIPED_DUE_TO_VERSION = 'answerIfWipedDueToVersion'
export const IPC_RESTART_ZEN_NODE = 'restartZenNode'
export const IPC_START_ZEN_NODE = 'startZenNode'
export const IPC_SHUT_DOWN_ZEN_NODE = 'shutdownZenNode'
export const IPC_BLOCKCHAIN_LOGS = 'blockchainLogs'
export const ZEN_NODE_RESTART_SIGNAL = 'SIGKILL'
export const ZEN_NODE_SHUTDOWN_SIGNAL = 'SIGINT'
export type ZenNodeChain = 'test' | 'main' | 'local';
type ZenNodeConfig = {
  wipe: boolean | string,
  wipeFull: boolean | string,
  isMining: boolean,
  net: ZenNodeChain
};

type ConstructorArgs = {
  webContents: *,
  onClose: () => void,
  onError: (Error, *) => void
};
class ZenNode {
  static zenNodeVersionRequiredWipe = doesZenNodeVersionRequiredWipe()
  ipcMessagesToSendOnFinishedLoad = []
  logs: string[] = []
  webContentsFinishedLoad = false
  node = {
    stderr: { pipe: _.noop, on: _.noop },
    stdout: { pipe: _.noop, on: _.noop },
    on: _.noop,
    kill: _.noop,
  }
  onClose = _.noop
  onError: (Error, *) => void
  webContents: *

  constructor({ webContents, onClose, onError }: ConstructorArgs) {
    this.webContents = webContents
    this.onClose = onClose
    this.onError = onError
    ipcMain.once(IPC_ASK_IF_WIPED_DUE_TO_VERSION, this.answerIfWipedDueToVersion)
  }

  answerIfWipedDueToVersion = () => {
    this.webContents.send(IPC_ANSWER_IF_WIPED_DUE_TO_VERSION, ZenNode.zenNodeVersionRequiredWipe)
  }

  config: ZenNodeConfig = {
    wipe: process.env.WIPE || process.argv.indexOf('--wipe') > -1 || process.argv.indexOf('wipe') > -1 || ZenNode.zenNodeVersionRequiredWipe,
    wipeFull: process.env.WIPEFULL || process.argv.indexOf('--wipe full') > -1 || process.argv.indexOf('wipefull') > -1,
    isMining: getInitialIsMining(),
    net: getInitialNet(),
  }

  init() {
    console.log('[ZEN NODE]: LAUNCHING ZEN NODE', this.zenNodeArgs)
    try {
      const node = spwanZenNodeChildProcess(this.zenNodeArgs, getZenNodePath())
      this.node = node
      this.node.on('error', (err) => this.onZenNodeError('this.node.on(error)', err))
      this.node.on('message', this.onMessage)
      if (this.config.wipe || this.config.wipeFull) {
        this.updateLastWipeInDb()
      }
      // reset wipe/wipefull args in case node was restarted with them
      this.config.wipe = false
      this.config.wipeFull = false
      this.node.stderr.pipe(process.stderr)
      this.node.stderr.on('data', this.onZenNodeStderr)
      this.node.stdout.pipe(process.stdout)
      this.node.stdout.on('data', this.onBlockchainLog)
      ipcMain.once(IPC_RESTART_ZEN_NODE, this.onRestartZenNode)
      ipcMain.once(IPC_SHUT_DOWN_ZEN_NODE, this.onShutdownZenNode)
      this.node.on('exit', this.onZenNodeExit)
    } catch (err) {
      this.onZenNodeError('init catch', err)
    }
  }

  shutdown() {
    this.node.kill(ZEN_NODE_SHUTDOWN_SIGNAL)
  }

  onBlockchainLog = (chunk: Buffer) => {
    const log = chunk.toString('utf8')
    this.logs = [...this.logs, log].slice(-100)
    console.log(`[ZEN NODE]: Received ${log} bytes of data.`)
    this.webContents.send(IPC_BLOCKCHAIN_LOGS, log)
  }
  onZenNodeStderr = (chunk: Buffer) => {
    const log = chunk.toString('utf8')
    this.logs = [...this.logs, log].slice(-100)
    shout('zen node stderr', log)
  }

  onRestartZenNode = (event: *, args: ZenNodeConfig) => {
    this.config = { ...this.config, ...args }
    this.node.kill(ZEN_NODE_RESTART_SIGNAL)
    if ('net' in args) {
      db.set('chain', args.net).write()
      this.webContents.reloadIgnoringCache()
    } else {
      this.init()
    }
  }

  onShutdownZenNode = (event: *, args: ZenNodeConfig) => {
    this.config = { ...this.config, ...args }
    this.shutdown()
  }

  onZenNodeExit = (code: number, signal: string) => {
    if (signal === ZEN_NODE_RESTART_SIGNAL) {
      shout('[ZEN NODE]: Restart through GUI')
    } else if (code === 1) {
      shout('zen node non zero exit code')
      dialog.showErrorBox(
        'Zen node uncaught error',
        'Non zero exit code (app will shutdown)',
      )
      if (this.webContentsFinishedLoad) {
        this.webContents.send(IPC_ZEN_NODE_NON_ZERO_EXIT, this.logs)
      } else {
        this.ipcMessagesToSendOnFinishedLoad.push({
          signal: IPC_ZEN_NODE_NON_ZERO_EXIT,
          data: this.logs,
        })
      }
      this.onError(new Error(`zen node non zero exit code. logs: ${this.logs.join('\n')}`))
    } else {
      console.log('[ZEN NODE]: Closed')
      this.onClose()
    }
  }
  updateLastWipeInDb() {
    db.set('lastWipe', {
      timestamp: Date.now(),
      walletVersion: WALLET_VERSION,
      zenNodeVersion: ZEN_NODE_VERSION,
    }).write()
  }
  onZenNodeError(identifier: string, err: *) {
    shout(`[ZEN NODE]: ${identifier}\n`, err)
    dialog.showErrorBox(
      `${err.message} (Wallet will shutdown)`,
      err.stack,
    )
    this.onError(err, { errorType: `zen node: ${identifier}` })
    this.onClose()
  }

  onMessage = (message: string) => {
    shout('[ZEN NODE]: message:\n', message)
  }

  onWebContentsFinishLoad() {
    this.webContentsFinishedLoad = true
    this.ipcMessagesToSendOnFinishedLoad.forEach(({ signal, data }) => {
      this.webContents.send(signal, data)
    })
  }

  get zenNodeArgs() {
    const {
      isMining, wipe, wipeFull, net,
    } = this.config
    const args = []
    if (wipe) {
      args.push('--wipe')
    } else if (wipeFull) {
      args.push('--wipe', 'full')
    }
    if (isMining) {
      args.push('--miner')
    }
    if (net) {
      args.push('--chain', net)
    }

    if (process.env.ZEN_NODE_API_PORT) {
      args.push('--api', `127.0.0.1:${process.env.ZEN_NODE_API_PORT}`)
    }

    shout('[ZEN NODE]: Zen node args', args)
    return args
  }
}

export default ZenNode

export function getZenNodePath() {
  return isInstalledWithInstaller()
    // $FlowFixMe
    ? path.join(process.resourcesPath, 'node_modules', '@zen', 'zen-node')
    : path.join(__dirname, '..', 'node_modules', '@zen', 'zen-node')
}

function isInstalledWithInstaller() {
  // $FlowFixMe
  return !process.resourcesPath.includes(path.join('node_modules', 'electron', 'dist'))
}

export function getInitialIsMining() {
  if (initialNetIsMainnet()) {
    return false
  }
  return !!(process.env.MINER || process.argv.indexOf('--miner') > -1 || process.argv.indexOf('miner') > -1 || db.get('config.isMining').value())
}

function getInitialNet(): ZenNodeChain {
  const dbChain = db.get('chain').value() || ''
  const net = formatChainForZenNode(dbChain)
  if (net !== '') { return net }
  if (process.env.ZEN_LOCAL_NET) {
    return 'local'
  }
  if (process.env.ZEN_TEST_NET) {
    return 'test'
  }
  return 'main'
}

function doesZenNodeVersionRequiredWipe() {
  let latestZenNodeVersionRequiringWipe = '0.9.11'
  if (getInitialNet() === 'test') {
    latestZenNodeVersionRequiringWipe = '0.9.28'
  }
  // first time user installs a version of the wallet with this flag feature,
  // or when user resets his local DB for any reason, we use the mocked version 0.0.0
  // to make sure wipe will happen, in case user has non valid chain
  const mockNoWipeRecordVersion = '0.0.0'
  const lastWipedOnZenNodeVersion = db.get('lastWipe.zenNodeVersion').value() || mockNoWipeRecordVersion
  const isWipeNeeded = compare(latestZenNodeVersionRequiringWipe, lastWipedOnZenNodeVersion) === 1
  if (isWipeNeeded) {
    logWipeNeeded(latestZenNodeVersionRequiringWipe, lastWipedOnZenNodeVersion, mockNoWipeRecordVersion) // eslint-disable-line max-len
  }
  return isWipeNeeded
}

// eslint-disable-next-line max-len
function logWipeNeeded(latestZenNodeVersionRequiringWipe, lastWipedOnZenNodeVersion, mockNoWipeRecordVersion) {
  console.log(`
  [********** ZEN NODE VERSION REQUIRES WIPE **********]
  Last version requiring wipe: ${latestZenNodeVersionRequiringWipe}
  Last wiped on version: ${lastWipedOnZenNodeVersion === mockNoWipeRecordVersion ? 'no local record of wiping found' : lastWipedOnZenNodeVersion}
  [********** /ZEN NODE VERSION REQUIRES WIPE **********]
  `)
}

function initialNetIsMainnet() {
  return getInitialNet() === 'main'
}
