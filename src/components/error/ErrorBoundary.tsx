'use client'

import React from 'react'
import ErrorPage from './ErrorPage'

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          error={this.state.error}
          onDismiss={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
