// @flow
import React, { Component } from 'react';
import type { Node } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import { Button } from 'react-polymorph/lib/components/Button';
import { ButtonSkin } from 'react-polymorph/lib/skins/simple/ButtonSkin';
import { defineMessages, intlShape } from 'react-intl';
import moment from 'moment';
import { set, omit } from 'lodash';
import styles from './WalletTransactionsList.scss';
import Transaction from './Transaction';
import { WalletTransaction } from '../../../domains/WalletTransaction';
import LoadingSpinner from '../../widgets/LoadingSpinner';
import { DEVELOPMENT } from '../../../../../common/types/environment.types';
import { VirtualTransactionList } from './render-strategies/VirtualTransactionList';
import { TransactionInfo, TransactionsGroup } from './types';
import type { WalletAssuranceMode } from '../../../api/wallets/types';
import type { Row } from './types';
import { SimpleTransactionList } from './render-strategies/SimpleTransactionList';

const messages = defineMessages({
  today: {
    id: 'wallet.summary.page.todayLabel',
    defaultMessage: '!!!Today',
    description: 'Label for the "Today" label on the wallet summary page.',
  },
  yesterday: {
    id: 'wallet.summary.page.yesterdayLabel',
    defaultMessage: '!!!Yesterday',
    description: 'Label for the "Yesterday" label on the wallet summary page.',
  },
  showMoreTransactionsButtonLabel: {
    id: 'wallet.summary.page.showMoreTransactionsButtonLabel',
    defaultMessage: '!!!Show more transactions',
    description: 'Label for the "Show more transactions" button on the wallet summary page.',
  },
  syncingTransactionsMessage: {
    id: 'wallet.summary.page.syncingTransactionsMessage',
    defaultMessage: '!!!Your transaction history for this wallet is being synced with the blockchain.',
    description: 'Syncing transactions message on async wallet restore.',
  },
});

type Props = {
  assuranceMode: WalletAssuranceMode,
  formattedWalletAmount: Function,
  hasMoreToLoad: boolean,
  isLoadingTransactions: boolean,
  isRestoreActive: boolean,
  isRenderingAsVirtualList: boolean,
  network: string,
  onShowMoreTransactions?: Function,
  onOpenExternalLink?: Function,
  showMoreTransactionsButton?: boolean,
  totalAvailable: number,
  transactions: Array<WalletTransaction>,
  walletId: string,
};

type State = {
  expandedTxs: Object,
};

const DATE_FORMAT = 'YYYY-MM-DD';

@observer
export default class WalletTransactionsList extends Component<Props, State> {

  static contextTypes = {
    intl: intlShape.isRequired,
  };

  static defaultProps = {
    isRenderingAsVirtualList: false,
    network: DEVELOPMENT,
    showMoreTransactionsButton: false,
    onShowMoreTransactions: () => {},
    onOpenExternalLink: () => {},
  };

  state = {
    expandedTxs: {},
  };

  expandedTransactions: WalletTransaction[] = [];
  virtualList: ?VirtualTransactionList;
  simpleList: ?SimpleTransactionList;
  loadingSpinner: ?LoadingSpinner;
  localizedDateFormat: 'MM/DD/YYYY';

  componentWillMount() {
    this.localizedDateFormat = moment.localeData().longDateFormat('L');
    // Localized dateFormat:
    // English - MM/DD/YYYY
    // Japanese - YYYY/MM/DD
  }

  groupTransactionsByDay(transactions: Array<WalletTransaction>): Array<TransactionsGroup> {
    const groups: Array<TransactionsGroup> = [];
    for (const transaction of transactions) {
      const date = moment(transaction.date);
      let group = groups.find((g) => (
        g.date.format(DATE_FORMAT) === date.format(DATE_FORMAT)
      ));
      if (!group) {
        group = new TransactionsGroup({ date, transactions: [] });
        groups.push(group);
      }
      group.transactions.push(transaction);
    }
    return groups.sort((a: TransactionsGroup, b: TransactionsGroup) => (
      b.date.valueOf() - a.date.valueOf()
    ));
  }

  isSpinnerVisible() {
    const spinner = this.loadingSpinner;
    if (spinner == null || spinner.root == null) return false;
    const spinnerRect = spinner.root.getBoundingClientRect();
    const clientHeight = document.documentElement ? document.documentElement.clientHeight : 0;
    const windowHeight = window.innerHeight;
    const viewHeight = Math.max(clientHeight, windowHeight);
    return !(spinnerRect.bottom < 0 || spinnerRect.top - viewHeight >= 0);
  }

  localizedDate(date: string) {
    const { intl } = this.context;
    // TODAY
    const today = moment().format(DATE_FORMAT);
    if (date === today) return intl.formatMessage(messages.today);
    // YESTERDAY
    const yesterday = moment().subtract(1, 'days').format(DATE_FORMAT);
    if (date === yesterday) return intl.formatMessage(messages.yesterday);
    // PAST DATE
    return moment(date).format(this.localizedDateFormat);
  }

  isTxExpanded = (tx: WalletTransaction) => (
    !!this.expandedTransactions.find(t => t.id === tx.id)
  );

  registerTxAsExpanded = (tx: WalletTransaction) => {
    this.expandedTransactions = this.expandedTransactions.concat([tx]);
    this.setState({
      expandedTxs: {
        ...this.state.expandedTxs,
        ...set({}, tx.id, tx)
      }
    });
  };

  removeTxFromExpanded = (tx: WalletTransaction) => {
    this.expandedTransactions = this.expandedTransactions.filter(
      (t) => t.id !== tx.id
    );
    this.setState({
      expandedTxs: {
        ...omit(this.state.expandedTxs, tx.id)
      }
    });
  };

  toggleTransactionExpandedState = (tx: WalletTransaction) => {
    if (this.isTxExpanded(tx)) {
      this.removeTxFromExpanded(tx);
    } else {
      this.registerTxAsExpanded(tx);
    }
    if (this.virtualList) {
      this.virtualList.updateInfoRowHeight(tx);
    } else if (this.simpleList) {
      this.simpleList.forceUpdate();
    }
  };

  onShowMoreTransactions = (walletId: string) => {
    if (this.props.onShowMoreTransactions) {
      this.props.onShowMoreTransactions(walletId);
    }
  };

  renderGroup = (data: TransactionsGroup): Node => (
    <div className={styles.groupDate}>
      {this.localizedDate(data.date)}
    </div>
  );

  renderTransaction = (data: TransactionInfo): Node => {
    const {
      assuranceMode,
      formattedWalletAmount,
      isRestoreActive,
      network,
      onOpenExternalLink,
    } = this.props;
    const { isFirstInGroup, isLastInGroup, tx } = data;
    const isExpanded = this.isTxExpanded(tx);
    const txClasses = classnames([
      styles.transaction,
      isFirstInGroup ? styles.firstInGroup : null,
      isLastInGroup ? styles[`lastInGroup${isExpanded ? 'Expanded' : 'Contracted'}`] : null,
    ]);
    return (
      <div id={`tx-${tx.id}`} className={txClasses}>
        <Transaction
          assuranceLevel={tx.getAssuranceLevelForMode(assuranceMode)}
          data={tx}
          formattedWalletAmount={formattedWalletAmount}
          isExpanded={this.isTxExpanded(tx)}
          isLastInList={isLastInGroup}
          isRestoreActive={isRestoreActive}
          network={network}
          onDetailsToggled={() => this.toggleTransactionExpandedState(tx)}
          onOpenExternalLink={onOpenExternalLink}
          state={tx.state}
        />
      </div>
    );
  };

  renderItem = (row: Row) => {
    if (row instanceof TransactionsGroup) {
      return this.renderGroup(row);
    }
    if (row instanceof TransactionInfo) {
      return this.renderTransaction(row);
    }
    return null;
  };

  render() {
    const {
      hasMoreToLoad,
      isLoadingTransactions,
      isRenderingAsVirtualList,
      isRestoreActive,
      showMoreTransactionsButton,
      totalAvailable,
      transactions,
      walletId,
    } = this.props;

    const { expandedTxs } = this.state;

    const { intl } = this.context;
    const transactionsGroups = this.groupTransactionsByDay(transactions);

    const loadingSpinner = (isLoadingTransactions || hasMoreToLoad) && !isRestoreActive ? (
      <LoadingSpinner ref={(component) => { this.loadingSpinner = component; }} />
    ) : null;

    const syncingTransactionsSpinner = isRestoreActive ? (
      <div className={styles.syncingTransactionsWrapper}>
        <LoadingSpinner big />
        <p className={styles.syncingTransactionsText}>
          {intl.formatMessage(messages.syncingTransactionsMessage)}
        </p>
      </div>
    ) : null;

    const buttonClasses = classnames([
      'primary',
      styles.showMoreTransactionsButton,
    ]);

    // Generate flat list with dates in-between
    const rows: Row[] = [];
    transactionsGroups.forEach((group) => {
      // First push the group into the list
      rows.push(group);
      // Followed by all transactions the tx in the group
      group.transactions.forEach((transaction, transactionIndex) => {
        const isFirstInGroup = (transactionIndex === 0);
        const isLastInGroup = (group.transactions.length === (transactionIndex + 1));
        rows.push(new TransactionInfo({
          tx: transaction,
          isLastInGroup,
          isFirstInGroup
        }));
      });
    });

    const showMoreTxButton = (
      <Button
        className={buttonClasses}
        label={intl.formatMessage(messages.showMoreTransactionsButtonLabel)}
        onClick={this.onShowMoreTransactions.bind(this, walletId)}
        skin={ButtonSkin}
      />
    );

    return (
      <div className={styles.component}>
        {syncingTransactionsSpinner}
        {isRenderingAsVirtualList ? (
          <VirtualTransactionList
            getExpandedTransactions={() => this.expandedTransactions}
            isTxExpanded={this.isTxExpanded}
            ref={(list) => this.virtualList = list}
            renderRow={this.renderItem}
            rows={rows}
            totalRows={totalAvailable}
            isLoadingSpinnerShown={loadingSpinner !== null}
            isSyncingSpinnerShown={isRestoreActive}
            expandedTxs={expandedTxs}
          />
        ) : (
          <SimpleTransactionList
            ref={(list) => this.simpleList = list}
            renderRow={this.renderItem}
            rows={rows}
          />
        )}
        {showMoreTransactionsButton ? showMoreTxButton : null}
        {loadingSpinner}
      </div>
    );
  }
}
