import React, { PureComponent } from 'react';
import hoistNonReactStatics from 'hoist-non-react-statics';
import exenv from 'exenv';

const getDisplayName = ({ name, displayName }) => displayName || name || 'Component';

export default function withSideEffect(
  reducePropsToState,
  handleStateChangeOnClient,
  mapStateOnServer
) {
  if (typeof reducePropsToState !== 'function') {
    throw new Error('Expected reducePropsToState to be a function.');
  }
  if (typeof handleStateChangeOnClient !== 'function') {
    throw new Error('Expected handleStateChangeOnClient to be a function.');
  }
  if (typeof mapStateOnServer !== 'undefined' && typeof mapStateOnServer !== 'function') {
    throw new Error('Expected mapStateOnServer to either be undefined or a function.');
  }

  return function wrap(WrappedComponent) {
    if (typeof WrappedComponent !== 'function') {
      throw new Error('Expected WrappedComponent to be a React component.');
    }

    const { Provider, Consumer } = React.createContext();

    class SideEffectProvider extends PureComponent {
      static canUseDOM = exenv.canUseDOM;
      static get defaultProps() {
        return { context: { } };
      }

      createdInstances = [];

      emitChange() {
        let state = reducePropsToState(this.createdInstances.map(instance => instance.props.props));

        if (SideEffectProvider.canUseDOM) {
          handleStateChangeOnClient(state);
        } else if (mapStateOnServer) {
          state = mapStateOnServer(state);
        }
        this.props.context.state = state;
      }

      componentDidUpdate() {
        this.emitChange();
      }

      render() {
        return (
          <Provider value={this}>
            {this.props.children}
          </Provider>
        );
      }
    }

    class SideEffectConsumer extends PureComponent {
      static displayName = 'SideEffectConsumer';

      constructor(props) {
        super(props);
        const { provider } = props;
        provider.createdInstances.push(this);
        if (exenv.canUseDOM) provider.forceUpdate();
        else provider.emitChange();
      }

      componentWillUnmount() {
        const { provider } = this.props;
        provider.createdInstances.splice(provider.createdInstances.indexOf(this), 1);
        if (exenv.canUseDOM) provider.forceUpdate();
        else provider.emitChange();
      }

      render() {
        return this.props.children;
      }
    }

    const SideEffect = hoistNonReactStatics(
      props => (
        <Consumer>
          {value => (
            <SideEffectConsumer provider={value} props={props}>
              <WrappedComponent {...props} />
            </SideEffectConsumer>
          )}
        </Consumer>
      ),
      WrappedComponent,
    );
    SideEffect.displayName = `SideEffect(${getDisplayName(WrappedComponent)})`;
    return { SideEffect, Provider: SideEffectProvider };
  };
};
