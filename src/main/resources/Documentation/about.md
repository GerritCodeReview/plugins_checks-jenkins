Implementation of checks UI for Jenkins CI servers
==================================================

This plugin registers a `ChecksProvider` with the Gerrit UI that will fetch
build results for a change from configured Jenkins servers and provide them to
the checks panel in a change screen.

Requirements
-----------

The Jenkins servers have to support CORS-requests. This can for example be achieved
by using a reverse proxy that sets the `Access-Control-Allow-Origin` and
`Access-Control-Allow-Credentials` header.

The Jenkins server additionally needs to install the
link:https://review.gerrithub.io/admin/repos/tdraebing/gerritchangequery-plugin,general[gerrit-change-query]
plugin that enables querying for job runs working on a given patchset.
