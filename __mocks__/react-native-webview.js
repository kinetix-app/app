// Jest has no native WebView module; the pose host renders nothing in tests.
const React = require('react');

const WebView = React.forwardRef(function WebView() {
  return null;
});

module.exports = { WebView, default: WebView };
