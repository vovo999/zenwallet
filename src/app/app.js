import React from 'react'
import ReactDOM from 'react-dom'
import {Provider} from 'mobx-react'
import {Router, Route, Switch} from 'react-router-dom'
import {createMemoryHistory} from 'history'

import Balances from './components/Balances/Balances'
import SendTx from './components/SendTx/SendTx'
import Receive from './components/Receive/Receive'
import ActivateContract from './components/ActivateContract/ActivateContract'
import RunContract from './components/RunContract/RunContract'
import SavedContracts from './components/SavedContracts/SavedContracts'
import Loading from './components/Loading/Loading'

import SecretPhrase from './components/OnBoarding/SecretPhrase/SecretPhrase'

import states from './states'

const history = createMemoryHistory({
  initialEntries: ['/'],
  initialIndex: 0
})

ReactDOM.render(
  <Provider history={history} {...states}>
    <Router history={history}>
      <Switch>
        <Route exact path="/receive" component={Receive} />
        <Route exact path="/send-tx/:assetHash?" component={SendTx} />
        <Route exact path="/activate-contract" component={ActivateContract} />
        <Route exact path="/run-contract/:contractAddress?" component={RunContract} />
        <Route exact path="/saved-contracts" component={SavedContracts} />
        <Route exact path="/loading" component={Loading} />
        <Route exact path="/secret-phrase" component={SecretPhrase} />
        <Route exact path="/" component={Balances} />
      </Switch>
    </Router>
  </Provider>, document.getElementById('app')
)
