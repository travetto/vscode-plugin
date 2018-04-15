import * as vscode from 'vscode';

const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;

function deserializeError(e: any) {
  if (e && e.$) {
    const err = new Error();
    for (const k of Object.keys(e)) {
      (err as any)[k] = e[k];
    }
    err.message = e.message;
    err.stack = e.stack;
    err.name = e.name;
    return err;
  } else if (e) {
    return e;
  }
}

const ITALIC = 'font-style: italic;';
const Style = {
  SMALL_IMAGE: '40%',
  FULL_IMAGE: 'auto',
  COLORS: {
    fail: rgba(255, 0, 0, 0.5),
    success: rgba(0, 255, 0, .5),
    unknown: rgba(255, 255, 255, .5)
  },
  IMAGE: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  } as Partial<vscode.DecorationRenderOptions>,
  ASSERT: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: { textDecoration: `none; ${ITALIC}` },
    light: { after: { color: 'darkgrey' } },
    dark: { after: { color: 'grey' } }
  } as Partial<vscode.DecorationRenderOptions>
};

export class Decorations {

  static context: vscode.ExtensionContext;

  static buildHover(err?: Error) {
    return err ? { language: 'html', value: `${deserializeError(err).stack}` } : undefined;
  }

  static line(n: number) {
    return { range: new vscode.Range(n - 1, 0, n - 1, 100000000000) }
  }

  static buildAssert(state: string) {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === 'fail' ? color : '',
    });
  }

  static buildImage(state: string, size = Style.FULL_IMAGE) {
    const img = Decorations.context.asAbsolutePath(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  static buildAssertion(assertion: { error?: Error, line: number, message?: string }): vscode.DecorationOptions {
    return assertion.error ? {
      ...this.line(assertion.line),
      hoverMessage: this.buildHover(assertion.error),
      renderOptions: {
        after: {
          textDecoration: ITALIC,
          contentText: `    ${assertion.message}`
        }
      }
    } : this.line(assertion.line);
  }

  static buildSuite(suite: { lines: { start: number } }) {
    return { ...this.line(suite.lines.start) };
  }

  static buildTest(test: { lines: { start: number }, error?: Error }) {
    return { ...this.line(test.lines.start), hoverMessage: this.buildHover(test.error) };
  }

  static buildStyle(entity: string, state: string) {
    return (entity === 'assertion') ?
      this.buildAssert(state) :
      this.buildImage(state, entity === 'test' ? Style.SMALL_IMAGE : Style.FULL_IMAGE);
  }
}
