// @flow
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import classNames from 'classnames';
import styles from './SidebarWalletMenuItem.scss';

@observer
export default class SidebarWalletMenuItem extends Component {

  props: {
    title: string,
    info: string,
    active: boolean,
    className: string,
    onClick: Function,
  };

  render() {
    const { title, info, active, className, onClick } = this.props;
    const componentStyles = classNames([
      styles.component,
      active ? styles.active : null,
      className,
    ]);
    return (
      <button className={componentStyles} onClick={onClick}>
        <span className={styles.meta}>
          <span className={styles.title}>{title}</span>
          <span className={styles.info}>{info}</span>
        </span>
      </button>
    );
  }

}
