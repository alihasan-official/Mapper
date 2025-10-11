import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
export class ErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error) { console.error(error); }
    render() {
        if (this.state.hasError)
            return _jsx("div", { children: "Something went wrong. Please refresh." });
        return this.props.children;
    }
}
