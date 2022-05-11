Implementation of checks UI for Jenkins CI servers

This plugin registers a `ChecksProvider` with the Gerrit UI that will fetch
build results for a change from configured Jenkins servers and provide them to
the checks panel in a change screen.

Limitations
-----------

Currently, only multibranch-pipeline jobs using the Gerrit SCM-source provided
by the link:https://plugins.jenkins.io/gerrit-code-review/[gerrit-code-review]-
plugin are supported.

The Jenkins Remote Access API does not provide all the information that could
be displayed in Gerrit, e.g. a result summary. Thus, as of now, this plugin
does not make full use of the checks API. As of right now, it will display the
following data in the UI:

- Builds for the selected patchset including previous attempts
- Status of the build
- Result of the build
- Link to the build and its logs
- A result summary stating the result category used by the CI (e.g. `Result: UNSTABLE`)
