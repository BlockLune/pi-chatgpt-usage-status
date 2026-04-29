# pi-chatgpt-usage-status

A small Pi extension that shows ChatGPT 5h and weekly rate limit in the status bar.

It displays remaining quota and reset time for:

- 5-hour usage window
- Weekly usage window

## Install

```shell
pi install https://github.com/BlockLune/pi-chatgpt-usage-status
```

## Usage

Select an `openai-codex` model in Pi. The status bar will show usage like:

```text
5h(82%,1.25h) Wk(91%,3.42d)
```

The extension reads your existing Pi OpenAI Codex auth from:

```text
~/.pi/agent/auth.json
```

## License

MIT
