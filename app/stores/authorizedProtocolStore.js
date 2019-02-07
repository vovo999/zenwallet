// @flow
import { observable, action, runInAction } from 'mobx'

import { postSign } from '../services/api-service'

class AuthorizedProtocolStore {
  @observable inprogress = false
  @observable commit = ''
  @observable contractId = ''
  @observable interval = ''
  @observable status = ''
  @observable errorMessage = ''

  constructor(publicAddressStore) {
    this.publicAddressStore = publicAddressStore
  }

  @action
  async signMessage(message, path, password) {
    try {
      this.inprogress = true
      const data = {
        message,
        path,
        password,
      }
      const response = await postSign(data)
      runInAction(() => {
        this.status = 'success'
        setTimeout(() => {
          this.status = ''
        }, 15000)
      })
      this.inprogress = false
      return response
    } catch (error) {
      runInAction(() => {
        console.error('signMessage error', error, error.response)
        this.errorMessage = error.response.data
      })
      this.inprogress = false
      this.status = 'error'
      setTimeout(() => {
        this.status = ''
      }, 15000)
    }
  }

  @action
  updateIntervalDisplay(interval) {
    this.interval = interval
  }

  @action
  updateCommitDisplay(commit) {
    this.commit = commit
  }

  @action
  updateContractIdDisplay(contractId) {
    this.contractId = contractId
  }
}

export default AuthorizedProtocolStore
