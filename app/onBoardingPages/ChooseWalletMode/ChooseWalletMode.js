// @flow
import React from 'react'
import Flexbox from 'flexbox-react'
import classnames from 'classnames'
import { inject } from 'mobx-react'
import { Link } from 'react-router-dom'
import { ipcRenderer } from 'electron'

import routes from '../../constants/routes'
import type { WalletMode } from '../../stores/walletModeStore'
import OnBoardingLayout from '../Layout/Layout'
import WalletModeStore from '../../stores/walletModeStore'
import history from '../../services/history'
import { IPC_SHUT_DOWN_ZEN_NODE, IPC_START_ZEN_NODE } from '../../ZenNode'


type Props = {
   walletModeStore: WalletModeStore
};
type State = {
  selectedMode: WalletMode
};

export class ChooseWalletMode extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { selectedMode: props.walletModeStore.mode }
  }

  onWalletModeChange = (selectedMode: WalletMode) => {
    this.setState({ selectedMode })
    this.props.walletModeStore.mode = selectedMode
  }

  onNextClicked = () => {
    const { walletModeStore } = this.props
    if (walletModeStore.mode === 'Full') {
      ipcRenderer.send(IPC_START_ZEN_NODE)
    } else {
      ipcRenderer.send(IPC_SHUT_DOWN_ZEN_NODE)
    }
    history.push(routes.IMPORT_OR_CREATE_WALLET)
  }

  render() {
    const { selectedMode } = this.state
    return (
      <OnBoardingLayout hideSteps className="choose-wallet-mode-container">
        <h1>Please select a mode to run your wallet</h1>
        <h3>Choose between a light wallet or a full node</h3>
        <div className="devider after-title" />
        <Flexbox flexDirection="row" justifyContent="space-between">
          <Flexbox
            onClick={() => { this.onWalletModeChange('Light') }}
            className={`${classnames(selectedMode === 'Light' && 'selected', 'box')}`}
            flexDirection="column"
          >
            <h5>Light wallet</h5>
            <p>
              Using a light wallet allows quick access to zen without running a full node.
              Instead you will securely connect to the zen protocol remote node.
            </p>
          </Flexbox>
          <Flexbox
            onClick={() => { this.onWalletModeChange('Full') }}
            className={`${classnames(selectedMode === 'Full' && 'selected', 'box')}`}
            flexDirection="column"
          >
            <h5>Full node</h5>
            <p>
              By running a full node you will download the zen protocol
              blockchain to your machine and help secure the network.
            </p>
          </Flexbox>
        </Flexbox>
        <div className="devider before-buttons" />
        <Flexbox flexGrow={1} justifyContent="flex-end" flexDirection="row">
          <Link className="secondary button button-on-left" to={routes.WELCOME_MESSAGES}>Back</Link>
          <button className="button button-on-right" onClick={this.onNextClicked}>Next</button>
        </Flexbox>
      </OnBoardingLayout>
    )
  }
}

export default inject('walletModeStore')(ChooseWalletMode)