import React, { useEffect, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import PropTypes from 'prop-types';
import 'tinymce';

import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/skins/ui/oxide/skin.css';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/code';
import 'tinymce/plugins/emoticons';
import 'tinymce/plugins/emoticons/js/emojis';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import 'tinymce/plugins/image';
import 'tinymce/plugins/codesample';
import '@edx/tinymce-language-selector';

import contentUiCss from 'tinymce/skins/ui/oxide/content.css?raw';
import contentCss from 'tinymce/skins/content/default/content.css?raw';

// The editor writing surface is a same-origin <iframe> that loads ONLY `content_style`
// (never the page's dark Paragon variant), so by default it renders black text on the
// (theme-darkened) iframe element = unreadable in dark. Baking the rules into
// `content_style` is not enough: it is read ONCE at editor init, so it cannot follow a
// theme toggle that happens after the editor mounts (nor activation by the link-flip,
// since this MFE renders no header toggle of its own). Instead, manage a dedicated
// <style id="rg-dark-content"> inside the editor iframe LIVE — add it when the
// `theme-variant=dark` cookie is set, remove it otherwise — so it works regardless of
// activation timing and switches both ways. (Mirrors authoring TinyMceWidget /
// discussions TinyMCEEditor, but reactive rather than init-only.)
//
// The teak fork additionally cited `contentUiCss`/`contentCss` stringifying to
// "[object Object]"; Verawood imports both with `?raw`, so that no longer applies.
const DARK_CONTENT_CSS = `
  body, body.mce-content-body {
    background-color: #212529 !important;
    color: #e8e8e8 !important;
  }
  body a { color: #6ccb6c !important; }
  body blockquote { border-left-color: #5c5c5c !important; color: #e8e8e8 !important; }
  body code { background-color: rgba(255, 255, 255, 0.08) !important; color: #f48fb1 !important; }
  body th, body td { border-color: #5c5c5c !important; }
  body hr { border-color: #5c5c5c !important; }
`;

function isDarkThemeActive() {
  return typeof document !== 'undefined'
    && /(?:^|;)\s*theme-variant=dark(?:;|$)/.test(document.cookie || '');
}

function applyEditorTheme(editor) {
  if (!editor || editor.removed) { return; }
  const doc = editor.getDoc && editor.getDoc();
  if (!doc || !doc.head) { return; }
  let styleEl = doc.getElementById('rg-dark-content');
  if (isDarkThemeActive()) {
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'rg-dark-content';
      doc.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== DARK_CONTENT_CSS) { styleEl.textContent = DARK_CONTENT_CSS; }
  } else if (styleEl) {
    styleEl.remove();
  }
}

export default function TextEditor(props) {
  const {
    onChange, onKeyUp, onInit, disabled, value,
  } = props;

  const editorRef = useRef(null);

  // Keep the editor content theme in sync with the live `theme-variant` cookie: poll
  // (catches the link-flip activation used where there is no header toggle) and listen
  // for the header's `rg-theme-variant` broadcast (live toggle in other MFEs).
  //
  // The poll is skipped under jest: a live interval keeps the worker from exiting and
  // drags the bulk-email-task-manager suites from ~16s to ~200s, past the 5s per-test
  // timeout. Initial state still comes from the `onInit` call below, so the themed
  // surface itself remains testable — only the polling loop is inert.
  useEffect(() => {
    const sync = () => applyEditorTheme(editorRef.current);
    const intervalId = process.env.NODE_ENV === 'test' ? null : setInterval(sync, 1000);
    const onMessage = (e) => { if (e && e.data && e.data.type === 'rg-theme-variant') { sync(); } };
    window.addEventListener('message', onMessage);
    return () => {
      if (intervalId) { clearInterval(intervalId); }
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return (
    <Editor
      initialValue=""
      init={{
        selector: 'textarea#editor',
        height: 600,
        branding: false,
        menubar: 'edit view insert format table tools',
        plugins: 'advlist code link lists table image codesample',
        toolbar:
          'formatselect fontselect bold italic underline forecolor | codesample bullist numlist alignleft aligncenter alignright alignjustify indent | blockquote link image code ',
        skin: false,
        content_css: false,
        content_style: `${contentUiCss.toString()}\n${contentCss.toString()}`,
        extended_valid_elements: 'span[lang|id] -span',
        block_unsupported_drop: false,
        image_advtab: true,
        name: 'emailBody',
        relative_urls: false,
        remove_script_host: false,
      }}
      onEditorChange={onChange}
      value={value}
      onKeyUp={onKeyUp}
      onInit={(evt, editor) => {
        editorRef.current = editor;
        applyEditorTheme(editor);
        onInit(evt, editor);
      }}
      disabled={disabled}
    />
  );
}

TextEditor.defaultProps = {
  onChange: () => {},
  onKeyUp: () => {},
  onInit: () => {},
  disabled: false,
  value: '',
};

TextEditor.propTypes = {
  onChange: PropTypes.func,
  onKeyUp: PropTypes.func,
  onInit: PropTypes.func,
  disabled: PropTypes.bool,
  value: PropTypes.string,
};
