// @flow

import React, { Component } from 'react'
import Flexbox from 'flexbox-react'
import { inject, observer } from 'mobx-react'
import cx from 'classnames'
import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { isEmpty } from 'lodash'
import * as mobx from 'mobx'
import Data from '@zen/zenjs/build/src/Data'
import { Address } from '@zen/zenjs/build/src/Address'

import AuthorizedProtocolStore from '../../stores/authorizedProtocolStore'
import NetworkStore from '../../stores/networkStore'
import PublicAddressStore from '../../stores/publicAddressStore'
import RunContractStore from '../../stores/runContractStore'
import { isValidHex, updateHash, payloadData } from '../../utils/helpers'
import { ref } from '../../utils/domUtils'
import Layout from '../../components/Layout'
import IsValidIcon from '../../components/IsValidIcon'
import ProtectedButton from '../../components/Buttons'
import FormResponseMessage from '../../components/FormResponseMessage'
import PasteButton from '../../components/PasteButton'
import AmountInput from '../../components/AmountInput'


type Props = {
  authorizedProtocolStore: AuthorizedProtocolStore,
  publicAddressStore: PublicAddressStore,
  runContractStore: RunContractStore,
  networkStore: NetworkStore
};

@inject('authorizedProtocolStore', 'publicAddressStore', 'runContractStore', 'networkStore')
@observer
class AuthorizedProtocol extends Component<Props> {
  componentDidMount() {
    this.props.publicAddressStore.fetch()
  }
  onCommitChanged = (evt: SyntheticEvent<HTMLInputElement>) => {
    this.props.authorizedProtocolStore.updateCommitDisplay(evt.currentTarget.value.trim())
  }

  onContractIdChanged = (evt: SyntheticEvent<HTMLInputElement>) => {
    this.props.authorizedProtocolStore.updateContractIdDisplay(evt.currentTarget.value.trim())
  }

  onReset = () => {
    this.AutoSuggestAssets.wrappedInstance.reset()
  }

  onPasteClicked = (clipboardContents: string) => {
    this.props.authorizedProtocolStore.commit = clipboardContents
    // $FlowFixMe
    this.elTo.focus()
  }

  updateIntervalDisplay = (interval) => {
    const { authorizedProtocolStore } = this.props
    authorizedProtocolStore.updateIntervalDisplay(interval)
  }

  renderCommitErrorMessage() {
    if (isEmpty(this.props.authorizedProtocolStore.commit) ? false : !this.isCommitValid) {
      return (
        <div className="error input-message">
          <FontAwesomeIcon icon={['far', 'exclamation-circle']} />
          <span>Commit identifier is invalid, it expect 40 hex characters</span>
        </div>
      )
    }
  }

  renderContractIdErrorMessage() {
    if (isEmpty(this.props.authorizedProtocolStore.contractId) ? false : !this.isContractIdValid) {
      return (
        <div className="error input-message">
          <FontAwesomeIcon icon={['far', 'exclamation-circle']} />
          <span>Contract identifier is invalid</span>
        </div>
      )
    }
  }

  renderSuccessResponse() {
    if (this.props.authorizedProtocolStore.status !== 'success') {
      return null
    }
    return (
      <FormResponseMessage className="success">
        <span>Transaction sent successfully.</span>
      </FormResponseMessage>
    )
  }

  renderErrorResponse() {
    const { status, errorMessage } = this.props.authorizedProtocolStore
    if (status !== 'error') {
      return null
    }
    return (
      <FormResponseMessage className="error">
        <span>There was a problem with the vote.</span>
        <span className="devider" />
        <p>Error message: {errorMessage}</p>
      </FormResponseMessage>
    )
  }
  // 1234512345123451234512345123451234512345
  onSubmitButtonClicked = async (confirmedPassword: string) => {
    const {
      publicAddressStore: {
        addresses,
        runWalletKeys,
      },
      authorizedProtocolStore: {
        commit,
        contractId,
        interval,
      },
    } = this.props
    const hash = updateHash(commit,interval)
    await runWalletKeys(confirmedPassword)
    const arrayPromise = mobx.toJS(addresses).map(item => {
      const { address, path } = item
      return this.props.authorizedProtocolStore.signMessage(hash, path, confirmedPassword)
        .then((result: string) => ([new Data.String(address).s, new Data.String(result)]))
        .catch(error => console.log(error))
    })
    Promise.all(arrayPromise)
      .then(item =>
        this.props.runContractStore
          .run(confirmedPassword, payloadData(contractId, new Data.DataList(item))))
      .catch(error => error)
  }

  get isCommitValid() {
    const { commit } = this.props.authorizedProtocolStore
    return (commit.length === 40) && isValidHex(commit)
  }

  get isContractIdValid() {
    const {
      networkStore: {
        chain,
      },
      authorizedProtocolStore: {
        contractId,
      },
    } = this.props
    try {
      Address.decode(chain.replace('net', ''), contractId)
      return true
    } catch (e) {
      return false
    }
  }

  get isSubmitButtonDisabled() {
    const { inprogress } = this.props.authorizedProtocolStore
    return inprogress || !this.isCommitValid
  }

  render() {
    const {
      authorizedProtocolStore: {
        commit, inprogress, interval, contractId,
      },
    } = this.props

    return (
      <Layout className="repo-vote">
        <Flexbox flexDirection="column" className="repo-vote-container">

          <Flexbox className="page-title">
            <h1>Authorized Protocol</h1>
          </Flexbox>
          <Flexbox flexDirection="column" className="form-container">
            <Flexbox flexDirection="column" className="form-row">
              <label htmlFor="contractid">Contract ID</label>
              <Flexbox flexDirection="row" className="destination-address-input">
                <Flexbox flexDirection="column" className="full-width relative">
                  <input
                    id="contractId"
                    ref={ref('contractId').bind(this)}
                    name="contractId"
                    type="text"
                    placeholder="Contract identifier"
                    className={cx({ 'is-valid': this.isContractIdValid, error: isEmpty(contractId) ? false : !this.isContractIdValid })}
                    onChange={this.onContractIdChanged}
                    value={contractId}
                    autoFocus
                  />
                  <IsValidIcon
                    isValid={this.isContractIdValid}
                    className="input-icon"
                    hasColors
                    isHidden={!contractId}
                  />
                  {this.renderContractIdErrorMessage()}
                </Flexbox>
                <PasteButton
                  className="button-on-right"
                  onClick={this.onPasteClicked}
                />
              </Flexbox>
            </Flexbox>
            <Flexbox flexDirection="column" className="form-row">
              <label htmlFor="commit">Commit ID</label>
              <Flexbox flexDirection="row" className="destination-address-input">
                <Flexbox flexDirection="column" className="full-width relative">
                  <input
                    id="commit"
                    ref={ref('commit').bind(this)}
                    name="commit"
                    type="text"
                    placeholder="Commit identifier"
                    className={cx({ 'is-valid': this.isCommitValid, error: isEmpty(commit) ? false : !this.isCommitValid })}
                    onChange={this.onCommitChanged}
                    value={commit}
                    autoFocus
                  />
                  <IsValidIcon
                    isValid={this.isCommitValid}
                    className="input-icon"
                    hasColors
                    isHidden={!commit}
                  />
                  {this.renderCommitErrorMessage()}
                </Flexbox>
              </Flexbox>
              <AmountInput
                amount={interval}
                amountDisplay={interval}
                maxDecimal={0}
                minDecimal={0}
                maxAmount={10000}
                exceedingErrorMessage="Invalid interval"
                onAmountDisplayChanged={this.updateIntervalDisplay}
                label="Interval"
              />
            </Flexbox>
          </Flexbox>
          <Flexbox flexDirection="row">
            { this.renderSuccessResponse() }
            { this.renderErrorResponse() }
            <Flexbox flexGrow={2} />
            <Flexbox flexGrow={1} justifyContent="flex-end" flexDirection="row">
              <ProtectedButton
                className={cx('button-on-right', { loading: inprogress })}
                disabled={this.isSubmitButtonDisabled}
                onClick={this.onSubmitButtonClicked}
              >
                {inprogress ? 'Voting' : 'Vote'}
              </ProtectedButton>
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Layout>
    )
  }
}

export default AuthorizedProtocol
