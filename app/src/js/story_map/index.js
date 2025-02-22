import './style.less';
import {getDictItem, getLabelFromObjectPath} from './../mx_helper_language.js';
import {el} from './../el/src/index.js';
import {ButtonPanel} from './../button_panel/index.js';
import {errorHandler} from './../error_handler/index.js';
import {modal} from './../mx_helper_modal.js';
import {
  onNextFrame,
  cancelFrame,
  waitFrameAsync,
  waitTimeoutAsync
} from './../animation_frame/index.js';
import {FlashItem} from './../icon_flash/index.js';
import {
  path,
  easingFun,
  scrollFromTo,
  cssTransform
} from './../mx_helper_misc.js';
import {dashboardHelper} from './../mx_helper_map_dashboard.js';
import {getArrayDiff} from './../array_stat/index.js';
import {createCanvas} from './../mx_helper_canvas.js';
import {
  isJson,
  isArray,
  isObject,
  isStory,
  isViewId,
  isNumeric,
  isEmpty,
  isView
} from './../is_test/index.js';
import {
  getMapPos,
  getViewRemote,
  getViewsRemote,
  getView,
  getViews,
  viewAdd,
  viewRemove,
  viewLayersRemove,
  viewLayersAdd,
  viewModulesRemove,
  viewsLayersOrderUpdate,
  getMap,
  getViewsLayersVisibles
} from './../mx_helper_map.js';

/**
 * Default settings
 */
import {settings} from './settings.js';

/**
 * Story and state storage
 */
const viewsAdditional = []; // will be in state
const story = {};
const state = {};

window._sm = {story, state};

/**
 * Read and evaluate story map
 * @param {Object} opt options
 * @param {String} opt.idView View id. If no view is given, fetch one by id
 * @param {Object} opt.view A view object containing a story
 * @param {Boolean} opt.edit Enable editing
 * @param {Boolean} opt.close Close
 * @param {Boolean} opt.update Update : partial cleaning
 * @param {Boolean} opt.storyAutoStart Bypass everything, start story, don't display back button
 */
export async function storyRead(opt) {
  try {
    if (opt.close) {
      await storyClose();
      return;
    }
    await init(opt);
    await initStory();
    await initViews();
    await build();
    await initListeners();
    await handleMissingImages();
    await initControls();
    await initLegendPanel();
    await initAdaptiveLayout();
    await appStateSave();
    await start();
  } catch (e) {
    errorHandler(e);
  }
}

async function init(opt) {
  const state = getState();
  Object.assign(state, opt);
  if (state.elStory) {
    state.update = true;
    state.initScroll = state.elStory.scrollTop;
    state.stepUpdate = state.stepActive;
  }
  state.map = getMap();
  state.enable = true;
}

async function initListeners() {
  removeAllListeners();
  /**
   * Edit mode
   */
  if (state.edit) {
    const {initEditing} = await import('./editor.js');
    await initEditing(state);
  } else {
    initMouseMoveListener();
  }

  /**
   * Init bullet container and listener
   */
  initKeydownListener();
  initClickListener();
  initResizeListener();
}

function removeAllListeners() {
  mx.listeners.removeListenerByGroup('story_map');
}

function initClickListener() {
  const state = getState();
  /**
   * Locked
   */
  mx.listeners.addListener({
    target: state.elStoryContainer,
    type: 'click',
    callback: () => {
      if (state.ct_editor) {
        return;
      }
      mx.panel_tools.panel.open();
      state.ctrlLock.shake('look_at_me');
      new FlashItem('ban');
    },
    group: 'story_map'
  });

  /**
   * When click, scroll to step
   */
  mx.listeners.addListener({
    target: state.elBullets,
    type: 'click',
    callback: bulletScrollTo,
    group: 'story_map'
  });
}

/**
 * Init listener for keydown event on window
 */
function initKeydownListener() {
  const map = getMap();
  const state = getState();
  state.map_keyboard_enabled = map.keyboard.isEnabled();

  if (state.map_keyboard_enabled) {
    map.keyboard.disable();
  }

  mx.listeners.addListener({
    target: window,
    type: 'keydown',
    callback: storyHandleKeyDown,
    group: 'story_map',
    onRemove: () => {
      if (state.map_keyboard_enabled) {
        map.keyboard.enable();
      }
    }
  });
}

/**
* Init listener for mousemove event on window
# @param {Object} o Story options
*/
function initMouseMoveListener() {
  const s = getSettings();
  let timer;
  let destroyed = false;
  let idFrameHideShow;
  const elBody = document.body;
  const elCtrls = elBody.querySelectorAll(`
      .mx-story-step-bullets,
      .mapboxgl-ctrl-bottom-left,
      .mapboxgl-ctrl-bottom-right,
      .mapboxgl-ctrl-top-right,
      .button-panel--main
      `);
  //.button-panel--main : hidden or displayed by user choice

  const classOpacitySmooth = 'mx-smooth-opacity';
  const classNoCursor = 'nocursor';

  for (const elCtrl of elCtrls) {
    elCtrl.classList.add(classOpacitySmooth);
  }

  mx.listeners.addListener({
    target: window,
    callback: mouseHider,
    type: ['mousemove', 'click', 'wheel'],
    group: 'story_map',
    onRemove: destroy
  });

  mx.events.on('story_step', mouseHider);

  function mouseHider() {
    if (timer) {
      clearTimeout(timer);
    }
    show();
    timer = setTimeout(() => {
      if (!destroyed) {
        hide();
      }
    }, s.opacity_auto_timeout || 1000);
  }

  function hide() {
    cancelFrame(idFrameHideShow);
    idFrameHideShow = onNextFrame(() => {
      elCtrls.forEach((el) => {
        el.style.opacity = 0.25;
      });
      elBody.classList.add(classNoCursor);
    });
  }

  function show() {
    cancelFrame(idFrameHideShow);
    idFrameHideShow = onNextFrame(() => {
      elCtrls.forEach((el) => {
        el.style.opacity = 1;
      });
      elBody.classList.remove(classNoCursor);
    });
  }

  function clean() {
    elCtrls.forEach((el) => {
      el.style.opacity = 1;
      el.classList.remove(classOpacitySmooth);
    });
  }

  function destroy() {
    destroyed = true;
    mx.events.off('story_step', mouseHider);
    show();
    clean();
  }
}

function updateSettings() {
  const story = getStory();
  const sSettings = path(story, 'settings', {});
  story._settings = Object.assign({}, settings, sSettings);
}

function getSettings() {
  const story = getStory();
  return story._settings;
}

/**
 * Check if a story is playing
 * @return {Boolean} story is playing
 */
export function isStoryPlaying() {
  const state = getState();
  return state.enable === true;
}

/**
 * Get story id
 * @return {String} Story views' id
 */

export function getStoryId() {
  if (!isStoryPlaying()) {
    return null;
  }
  const state = getState();
  return state.idView;
}

/**
 * Get current views featured in step
 * @return {Array} array of views id
 */
export function getViewsStep() {
  if (!isStoryPlaying()) {
    return null;
  }
  const views = [];
  const state = getState();
  /**
  * TODO : Duplicate code ! merge this code with getStoryViewsId
  */ 
  for (const item of state.step.views) {
    if (isViewId(item)) {
      views.push(id);
    } else if (isObject(item) && isViewId(item.id)) {
      views.push(item.id);
    } else if (isObject(item) && isViewId(item.view)) {
      views.push(item.view);
    }
  }
  return views;
}

/**
 * Get current state
 */

function getState() {
  return state;
}

function getStory() {
  return story || {};
}

async function storyUiClear() {
  const state = getState();
  /**
   * Remove ui elements
   */
  if (state._init_ui) {
    state.elStory.remove();
    state.elStoryContainer.remove();
    state.elBullets.remove();
    state.elBulletsContainer.remove();
    state._init_ui = false;
  }
}

/**
 * Close current story if any.
 */
export async function storyClose() {
  const state = getState();
  state.enable = false;
  mx.events.fire('story_close');
  removeAllListeners();
  if (state.ct_editor_remove) {
    state.ct_editor_remove();
  }
  await waitTimeoutAsync(100);
  await storyStop();
  await storyUiClear();
  await storyMapLock('lock');
  new FlashItem('sign-out');
  await appStateRestore();
  await cleanState();
}

export async function storyStop() {
  const map = getMap();
  try {
    map.stop(false);
    window.stop();
  } catch (e) {
    console.warn(e);
  }
  const mapBusy = !map.isStyleLoaded();
  if (mapBusy) {
    await map.once('idle');
  }
}

async function cleanState() {
  const story = getStory();
  const state = getState();

  for (const k in story) {
    delete story[k];
  }

  for (const k in state) {
    delete state[k];
  }
}

/**
 * Get story view or fetch it remotely
 */
async function initStory() {
  const state = getState();
  state.view = getView(state.view || state.idView);
  if (!isView(state.view)) {
    state.view = await getViewRemote(state.idView);
  }
  if (isStory(state.view)) {
    state.idView = state.view.id;
  } else {
    modal({
      title: 'Error',
      content: 'Invalid or empty story',
      addBackground: true
    });
    await cleanState();
    throw new Error('No story to read');
  }
  Object.assign(story, state.view.data.story);
  updateSettings();
}

export async function cleanRemoveViews() {
  const map = getMap();
  const views = getViews();
  const vVisible = getViewsLayersVisibles();
  map.stop();

  for (let idView of vVisible) {
    await viewLayersRemove({
      idView: idView
    });
    await viewModulesRemove(idView);
  }

  while (viewsAdditional.length) {
    const view = viewsAdditional.pop();
    const pos = views.indexOf(view);
    if (pos > -1) {
      views.splice(pos, 1);
    }
  }
  return true;
}

/**
 * Evaluate missing view and fetch them if needed
 */
async function initViews() {
  const idViewsStory = [];
  const idViewsToAdd = [];
  const viewsBase = getViews();
  const idViewsBase = viewsBase.map((v) => v.id);
  /**
   * Case views are stored within state.views (deprecated)
   */
  for (const id of story?.views || []) {
    if (isViewId(id)) {
      idViewsStory.push(id);
    }
  }

  /**
   * Case when views are not stored in state.view but only in steps (current behaviour).
   */
  idViewsStory.push(...getStoryViewsId());

  /**
   * Create a list of views id to download
   * ( e.g. if they are from another project )
   */
  for (const id of idViewsStory) {
    const existsInBase = idViewsBase.includes(id);
    const existsInAdd = idViewsToAdd.includes(id);
    if (!existsInBase && !existsInAdd) {
      idViewsToAdd.push(id);
    }
  }

  /**
   * Fetch additional views
   */
  const viewsFetched = await getViewsRemote(idViewsToAdd);
  viewsAdditional.push(...viewsFetched);

  /**
   * addExternal views to views base
   */
  viewsBase.push(...viewsAdditional);
}

/**
 * Add listeners : scroll, key, adaptive screen
 */

async function start() {
  const state = getState();

  mx.events.fire('story_start');
  /**
   * Initial layout
   */
  updateScrollRect();
  updateLayout();

  /**
   * Handle update step
   */
  if (state.initScroll) {
    state.elStory.scrollTop = state.initScroll;
  }
  if (state.stepUpdate) {
    state.stepActive = null;
    await storyGoTo(state.stepUpdate);
  }
  /**
   * Render
   */
  await render();

  /* main animation loop */
  async function render() {
    await waitFrameAsync();
    const sd = state.scrollData;

    if (!isStoryPlaying()) {
      return;
    }

    // NOTE: scrollTop does not reflect actual dimension but non scaled ones.
    const posNow = state.elStory.scrollTop * state.scaleWrapper || 1;
    const posLast = sd.distTop;
    if (posLast === posNow) {
      return render();
    }

    sd.distTop = posNow;
    await storyUpdateSlides();
    return render();
  }
}

/**
 * Update layout on resize
 */

function initResizeListener() {
  mx.listeners.addListener({
    target: window,
    type: 'resize',
    callback: updateLayout,
    group: 'story_map'
  });
}

/**
 * Init values for screen adaptiveness/scaling function
 * @param {Object} o story options
 */
async function initAdaptiveLayout() {
  const state = getState();
  const s = getSettings();

  /**
   * Reset if needed
   */
  resetMapStyle();

  /**
   * Save style map : used when reset
   */
  state.classMap = state.elMapContainer.className;
  state.styleMap = state.elMapContainer.style;

  /**
   * Add wrapper classes
   */
  state.elMapContainer.classList.add(s.class_container);
  state.elMapContainer.classList.add(s.class_wrapper);
  state.elStoryContainer.classList.add(s.class_wrapper);

  /**
   * Initial rect story for sizing
   */

  state.rectStory = state.elStory.getBoundingClientRect();
}
function updateAdaptiveLayout() {
  const state = getState();
  state.scaleWrapper = Math.min(
    window.innerWidth / state.rectStory.width,
    window.innerHeight / state.rectStory.height
  );

  const height = state.rectStory.height * state.scaleWrapper;
  const width = state.rectStory.width * state.scaleWrapper;
  state.elStoryContainer.style[cssTransform] = `translate(-50%,-50%) scale(${
    state.scaleWrapper
  })`;
  state.elMapContainer.style.height = `${height}px`;
  state.elMapContainer.style.width = `${width}px`;
  state.elMapContainer.style[cssTransform] = 'translate(-50%,-50%)';
  state.map.resize();
}

function getStoryViewsId() {
  const story = getStory();
  const idViewsStory = [];
  let i = 0;
  for (const step of story.steps) {
    if (isObject(step) && isArray(step.views)) {
      let j = 0;

      /**
       * Accepted id are
       * array of id,
       * array of object with id as key,
       * array of object with view as key
       * if something else : warn
       */
      for (const item of step.views) {
        if (isViewId(item)) {
          idViewsStory.push(id);
        } else if (isObject(item) && isViewId(item.id)) {
          idViewsStory.push(item.id);
        } else if (isObject(item) && isViewId(item.view)) {
          idViewsStory.push(item.view);
        } else {
          console.warn(
            `View ${j} of step ${i} is not recognised. Received:`,
            item
          );
          step.views.splice(j, 1);
        }
        j++;
      }
      i++;
    }
  }
  return idViewsStory;
}

/**
 * Set scroll state values
 */
function updateScrollRect() {
  const state = getState();
  const elStory = state.elStory;
  const rect = elStory.getBoundingClientRect();

  if (!state.scrollData) {
    state.scrollData = {};
  }
  const sd = state.scrollData;
  sd.elStory = elStory;
  sd.rect = rect;
  sd.height = rect.height;
  sd.trigger = rect.height * 0.5;
  sd.distTop = -1;
}

/**
 * Update layout
 */
function updateLayout() {
  updateScrollRect();
  updateAdaptiveLayout();
  setStepConfig();
}

async function initControls() {
  const state = getState();
  const s = getSettings();
  if (state._init_buttons) {
    return;
  }
  state._init_buttons = true;

  /**
   * Control panel buttons
   */
  const ctrls = mx.panel_tools.controls;
  state.ctrlMode3d = ctrls.getButton(s.ctrl_btn_3d_terrain);
  state.ctrlAerial = ctrls.getButton(s.ctrl_btn_theme_sat);
  state.ctrlLock = ctrls.getButton(s.ctrl_btn_lock);
}

/*
 * Set position
 */
async function bulletScrollTo(e) {
  try {
    const step = e.target.dataset.step;
    if (step) {
      e.stopPropagation();
      await storyGoTo(step);
    }
  } catch (e) {
    console.warn(e);
  }
}

/**
 * Set step config : dimention, number, bullets
 */
function setStepConfig() {
  const state = getState();
  const sd = state.scrollData;
  const elBullets = state.elBullets;
  const elSteps = state.elStory.querySelectorAll('.mx-story-step');

  state.stepsConfig = [];
  elBullets.innerHTML = '';
  let s = 0;
  for (const elStep of elSteps) {
    s++;
    /*
     * config init
     */
    const config = {};
    const stepName = elStep.dataset.step_name;
    const rect = elStep.getBoundingClientRect();

    config.elStep = elStep;
    config.elSlides = elStep.querySelectorAll('.mx-story-slide');
    config.slidesConfig = [];

    /*
     * Save step dimensions
     */
    config.end = s * rect.height;
    config.start = config.end - rect.height;
    config.startUnscaled = config.start * (1 / state.scaleWrapper);
    config.height = rect.height;
    config.width = rect.width;

    /*
     * Bullets init
     */
    const elBullet = el(
      'div',
      {
        class: ['mx-story-step-bullet', 'shadow', 'mx-pointer', 'hint--top'],
        'aria-label': stepName ? stepName : `Step ${s}`,
        dataset: {
          to: config.startUnscaled,
          step: s - 1
        }
      },
      `${s}`
    );

    elBullets.appendChild(elBullet);
    config.elBullet = elBullet;

    if (s === 1) {
      elBullet.classList.add('mx-story-step-active');
    }

    /*
     * Evaluate slides and save in config
     */
    for (const elSlide of config.elSlides) {
      const slideConfig = [];
      try {
        const slideConfigJSON = elSlide.dataset.slide_config;
        const validJSON = isJson(slideConfigJSON);
        if (validJSON) {
          slideConfig.push(...JSON.parse(slideConfigJSON || '[]'));
        }
      } catch (e) {
        console.error(e, slideConfig);
      }
      config.slidesConfig.push(slideConfig);
    }

    state.stepsConfig.push(config);
  }

  /**
   * Set initial scroll position
   */
  if (sd.distTop) {
    state.elStory.scrollTop = sd.distTop * 1;
  }
}

async function storyUpdateSlides() {
  /*
   * Apply style
   */
  const state = getState();
  const sd = state.scrollData;
  const sc = state.stepsConfig;
  let percent = 0;
  let elSlides;
  let elStep;
  let isActive, isInRange, isInRangeAnim, toActivate;
  let clHidden = 'mx-visibility-hidden';
  let clRemove = 'mx-display-none';
  let isHidden = false;
  let config;
  if (!isStoryPlaying()) {
    return;
  }
  for (let s = 0, sL = sc.length; s < sL; s++) {
    /**
     *   1       2       s       e       5       6
     *   |.......|.......|.......|.......|.......|
     *                t|.......|b
     */
    config = sc[s];
    percent = ((config.end - sd.distTop) / (config.height * 2)) * 100;
    isInRange = percent < 75 && percent >= 25;
    isInRangeAnim = percent < 600 && percent >= -500;
    isActive = state.stepActive === s;
    toActivate = isInRange && !isActive;
    elStep = config.elStep;
    elSlides = config.elSlides;
    isHidden = elStep.classList.contains(clHidden);

    /**
     * Update slide animation
     */
    if (isInRangeAnim) {
      if (isHidden) {
        elStep.classList.remove(clHidden);
      }
      let i = 0;
      for (const elSlide of elSlides) {
        const slideTransform = storySetTransform({
          config: config.slidesConfig[i++],
          percent: percent
        });
        elSlide.classList.remove(clRemove);
        elSlide.style[cssTransform] = slideTransform;
      }
    } else if (!isHidden) {
      elStep.classList.add(clHidden);
      for (const elSlide of elSlides) {
        elSlide.classList.add(clRemove);
      }
    }

    if (toActivate) {
      await storyPlayStep(s);
      await updateBullets();
    }
  }
}

async function updateBullets() {
  if (!isStoryPlaying()) {
    return;
  }
  const state = getState();
  const s = state.stepActive;
  const elBullets = state.elBullets;
  const nStep = state.stepsConfig.length;
  let b = 0;
  for (const c of state.stepsConfig) {
    const elBullet = c.elBullet;
    if (b++ <= s) {
      elBullet.classList.add('mx-story-step-active');
    } else {
      elBullet.classList.remove('mx-story-step-active');
    }
  }
  /**
   * Update bullet container center
   */
  const bContWidth = elBullets.getBoundingClientRect().width;
  const bItemWidth = bContWidth / nStep;
  const dist = bContWidth / 2 - (s + 1) * bItemWidth;
  elBullets.style[cssTransform] = `translateX(${dist}px)`;
}

/*
 * listen for keydown
 */

const keyState = {
  keys: [],
  idTimeout: 0
};

async function storyHandleKeyDown(event) {
  const state = getState();

  if (!isStoryPlaying()) {
    return;
  }

  const editMode = state.edit === true;
  const isEditing = editMode && state?.ct_editor?.isEditing();
  const editAndMapFocus = editMode && !isEditing && hasFocusOnMap();
  const valid = !editMode || editAndMapFocus;

  if (!valid) {
    return;
  }

  const isNum = isNumeric(event.key);

  if (isNum) {
    /*
     * Combo : 1 ... 2 -> 12
     */
    prevent();
    clearTimeout(keyState.idTimeout);
    keyState.keys.push(event.key);
    keyState.idTimeout = setTimeout(async () => {
      try {
        const sNum = keyState.keys.join('') * 1;
        keyState.keys.length = 0;
        await storyGoTo(sNum - 1);
      } catch (e) {
        console.warn(e);
      }
    }, 200);
    return;
  }

  switch (event.key) {
    case 'Escape':
      if (!state.autoStart && !state.edit) {
        prevent();
        await storyClose();
      }
      break;
    case 'l':
      prevent();
      state.ctrlLock.action('toogle');
      break;
    case ' ':
      prevent();
      await storyAutoPlay('start');
      break;
    case 'ArrowDown':
    case 'ArrowRight':
      prevent();
      await storyAutoPlay('stop');
      await storyGoTo('next');
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      prevent();
      await storyAutoPlay('stop');
      await storyGoTo('previous');
      break;
    default:
      return;
  }

  function prevent() {
    event.preventDefault();
    event.stopPropagation();
  }
}

export async function storyGoTo(to, useTimeout, funStop) {
  const state = getState();
  const story = getStory();
  const steps = story.steps;
  const stepsDim = state.stepsConfig;
  const elStory = state.elStory;
  const height = state.rectStory.height;
  const start = elStory.scrollTop;
  const currentStep = state.currentStep || 0;
  let timeout = 0;
  let nextStep;
  let previousStep;
  let destStep;

  const maxStep = steps.length - 1;

  switch (to) {
    case 'next':
    case 'n':
      nextStep = currentStep + 1;
      destStep = nextStep > maxStep ? 0 : nextStep;
      break;
    case 'previous':
    case 'p':
      previousStep = currentStep - 1;
      destStep = previousStep < 0 ? maxStep : previousStep;
      break;
    default:
      if (isNumeric(to)) {
        destStep = to >= maxStep ? maxStep : to < 0 ? 0 : to;
      }
  }

  const stop = stepsDim[destStep].startUnscaled;
  const step = steps[currentStep];
  const easing = path(step, 'autoplay.easing') || 'easeIn';
  const duration = path(step, 'autoplay.duration') || 1000;
  const easing_p = path(step, 'autoplay.easing_power') || 1;

  if (useTimeout) {
    timeout = path(step, 'autoplay.timeout') || 1000;
  }

  const easeFun = easingFun({
    type: easing,
    power: easing_p
  });

  const jump = state.storyGoToDone === false || Math.abs(stop - start) > height;

  state.storyGoToDone = false;

  const promScroll = scrollFromTo({
    emergencyStop: funStop,
    timeout: timeout,
    el: elStory,
    from: start,
    to: stop,
    jump: jump,
    during: duration,
    using: easeFun
  });

  await maxWait(promScroll, duration + timeout);

  state.storyGoToDone = true;

  return {
    step: destStep,
    end: destStep === maxStep
  };
}

/**
 * Prmise race
 */
function maxWait(prom, duration) {
  return Promise.race([
    prom,
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, duration);
    })
  ]);
}

export async function storyAutoPlay(cmd) {
  const state = getState();
  const enabled = state.autoplay || false;
  const playStart = cmd === 'start' && !enabled;
  const playStop = (cmd === 'stop' && enabled) || (cmd === 'start' && enabled);
  const playNext = cmd === 'next' && enabled;

  const stopControl = function() {
    return state.autoplay === false;
  };

  if (playStart) {
    new FlashItem('play');
    state.autoplay = true;
    storyAutoPlay('next');
  }

  if (playStop) {
    state.autoplay = false;
    new FlashItem('stop');
  }

  if (playNext) {
    await storyGoTo('next', true, stopControl);
    if (state.autoplay) {
      storyAutoPlay('next');
    }
  }
  return state.autoplay;
}

/**
 * Control map pan during story map
 * @param {String} cmd Action : recalc, unlock, toggle;
 */
export async function storyMapLock(cmd) {
  try {
    const dh = dashboardHelper;
    const state = getState();
    const valid = ['recalc', 'lock', 'unlock', 'toggle'].includes(cmd);
    if (!valid) {
      cmd = 'toggle';
    }
    const btn = state.ctrlLock;
    const elButton = btn.elButton;
    const elIcon = elButton.querySelector('.fa');
    const elStoryContainer = state.elStoryContainer;
    const classLock = 'fa-lock';
    const classUnlock = 'fa-unlock';
    const classNoEvent = 'mx-events-off';
    const isLocked = elIcon.classList.contains(classLock);
    const isUnlocked = !isLocked;
    const isRecalc = cmd === 'recalc';

    const cases = {
      unlock: true,
      lock: false,
      recalc: !isLocked,
      toggle: isLocked
    };

    const toUnlock = cases[cmd];
    const hasChanged = toUnlock !== isUnlocked;

    if (toUnlock) {
      elIcon.classList.remove(classLock);
      elIcon.classList.add(classUnlock);
      elStoryContainer.classList.add(classNoEvent);
      if (!isRecalc && hasChanged) {
        new FlashItem('unlock');
      }
    } else {
      mx.events.fire('story_lock');
      elIcon.classList.add(classLock);
      elIcon.classList.remove(classUnlock);
      elStoryContainer.classList.remove(classNoEvent);
      if (!isRecalc && hasChanged) {
        new FlashItem('lock');
      }
      if (dh.hasInstance()) {
        const d = dh.getInstance();
        d.hide();
      }
    }
  } catch (e) {
    console.warn(e);
  }
}

async function storyControlsEnable() {
  const s = getSettings();
  const state = getState();
  const ctrls = mx.panel_tools.controls;
  const autoStart = state.autoStart === true;
  const update = state.update === true;

  if (state._controls_enabled) {
    return;
  }

  state._controls_enabled = true;
  state.controlsAdded = [];
  state.controlsRemoved = [];
  state.panelsRemoved = [];

  const keyBtnShow = [];
  /**
   * Controls
   */

  if (autoStart || update) {
    keyBtnShow.push(...s.ctrl_btn_enable_update_mode);
  } else {
    keyBtnShow.push(...s.ctrl_btn_enable);
  }
  for (const key of s.ctrl_btn_disable) {
    const ctrl = ctrls.getButton(key);
    ctrl.hide();
    state.controlsRemoved.push(ctrl);
  }
  for (const key of keyBtnShow) {
    const ctrl = ctrls.getButton(key);
    ctrl.show();
    state.controlsAdded.push(ctrl);
  }

  /**
   * Panels
   */
  const panelDisable = s.panel_disable;
  for (const panel of window._button_panels) {
    for (const key of panelDisable) {
      if (panel.opt.id === key) {
        panel.hide();
        state.panelsRemoved.push(panel);
      }
    }
  }

  /**
   * Preview button ( edit mode )
   */
  const elBtnPreview = document.querySelector('#btnViewPreviewStory');
  if (elBtnPreview) {
    elBtnPreview.removeAttribute('disabled');
  }

  /**
   * Set control map pan lock mode
   */
  await storyMapLock('recalc');
}

async function appStateSave() {
  const state = getState();

  if (state._app_state_saved) {
    return;
  }
  if (state.enable) {
    /**
     * Enable story controls
     */
    await storyControlsEnable();

    /**
     * Get controls status
     */
    const hasAerial = state.ctrlAerial.isActive();
    const has3d = state.ctrlMode3d.isActive();

    /**
     * Get map / view set
     */
    const position = getMapPos();
    const oldViews = getViewsLayersVisibles();

    /**
     * Clear views
     */
    for (const id of oldViews) {
      console.log('story remove view', id);
      await viewRemove(id);
    }

    /**
     * Hide modes
     */

    state.ctrlAerial.action('hide');
    state.ctrlMode3d.action('hide');

    /*
     * save in state
     */
    Object.assign(state, {
      oldViews,
      position,
      hasAerial,
      has3d
    });

    state._app_state_saved = true;
  }
}

async function appStateRestore() {
  const state = getState();
  const map = getMap();
  /**
   * Restore
   */
  const pos = state.position;

  map.jumpTo({
    zoom: pos.z,
    bearing: pos.b,
    pitch: pos.p,
    center: [pos.lng, pos.lat]
  });

  resetMapStyle();
  resetControls();
  resetPanels();
  removeLegendPanel();

  await cleanRemoveViews();

  for (const id of state.oldViews) {
    await viewAdd(id);
  }
}

function resetControls() {
  const state = getState();
  if (state.hasAerial) {
    state.ctrlAerial.action('show');
  } else {
    state.ctrlAerial.action('hide');
  }
  if (state.has3d) {
    state.ctrlMode3d.action('show');
  } else {
    state.ctrlMode3d.action('hide');
  }
  if (isArray(state.controlsAdded)) {
    for (const ctrl of state.controlsAdded) {
      ctrl.hide();
    }
  }
  if (isArray(state.controlsRemoved)) {
    for (const ctrl of state.controlsRemoved) {
      ctrl.show();
    }
  }
}
function resetPanels() {
  const state = getState();
  if (isArray(state.panelsRemoved)) {
    for (const panel of state.panelsRemoved) {
      panel.show();
    }
  }
}

async function initLegendPanel() {
  const state = getState();
  if (state.buttonLegend) {
    return;
  }
  /**
   * Button Legend
   */
  state.buttonLegend = new ButtonPanel({
    elContainer: document.body,
    panelFull: true,
    position: 'bottom-left',
    tooltip_position: 'right',
    button_text: getDictItem('button_legend_button'),
    button_lang_key: 'button_legend_button',
    button_classes: ['fa', 'fa-list-ul'],
    item_content_classes: ['button-panel--item-content-flex-col'],
    container_classes: ['button-panel--container-no-full-width'],
    container_style: {
      width: '300px',
      height: '300px',
      minWidth: '200px',
      minHeight: '200px',
      maxWidth: '50vw'
    }
  });
}
function removeLegendPanel() {
  const state = getState();
  state.buttonLegend.destroy();
}

function resetMapStyle() {
  const state = getState();
  const map = getMap();
  if (state.styleMap) {
    state.elMapContainer.style = state.styleMap;
  }

  if (state.classMap) {
    state.elMapContainer.className = state.classMap;
  }
  map.resize();
}

/**
 * Initial scroll position
 */

/*async function initStoryScroll() {*/
/*const state = getState();*/
/*if (state.initScroll) {*/
/*state.elStory.scrollTop = state.initScroll;*/
/*state.initScroll = null;*/
/*await waitTimeoutAsync(10);*/
/*await storyUpdateSlides();*/
/*await updateBullets();*/
/*}*/
/*}*/

/**
 * Build story ui
 */
async function build() {
  storyUiClear();
  await buildMain();
  await buildBullets();
  state._init_ui = true;
}

async function buildMain() {
  const glfo = getLabelFromObjectPath;
  const state = getState();
  const story = getStory();
  const s = getSettings();

  if (!story.steps || story.steps.length < 1) {
    return;
  }
  /**
   * Set default
   */
  state.elMapContainer = state.map.getContainer();
  state.elMapControls = state.elMapContainer.querySelector(
    `.${s.class_controls}`
  );

  /**
   * Story map container
   */
  state.elStoryContainer = el('div', {
    class: s.class_container,
    id: s.id_story
  });

  state.elStory = el(
    'div',
    {
      class: s.class_story
    },
    story.steps.map((step, stepNum) => {
      /**
       * For each step
       */
      return el(
        'div',
        {
          class: s.class_step,
          dataset: {
            step_name: step.name
          }
        },
        step.slides.map((slide, slideNum) => {
          const config = JSON.stringify(slide.effects || []);
          /**
           * For each slide
           */
          return el(
            'div',
            {
              dataset: {
                slide_config: config
              },

              class: [s.class_slide].concat(
                slide.classes.map((c) => s.class_story + '-' + c.name),
                'mx-display-none'
              )
            },
            el(
              'div',
              {
                class: s.class_slide_front,
                style: {
                  color: slide.color_fg || s.colors.fg,
                  borderColor: slide.color_fg || s.colors.fg,
                  fontSize: slide.size_text + 'px' || s.sizes.text + 'px',
                  overflowY: slide.scroll_enable ? 'scroll' : 'hidden'
                },
                dataset: {
                  editable: true,
                  name: stepNum + ':' + slideNum
                }
              },
              glfo({
                obj: slide,
                path: 'html',
                default: '<p></p>'
              })
            ),
            el('div', {
              style: {
                backgroundColor: slide.color_bg || s.colors.bg,
                opacity:
                  slide.opacity_bg === 0
                    ? 0
                    : slide.opacity_bg || s.colors.alpha
              },
              class: s.class_slide_back
            })
          );
        }) // end slides
      );
    }) // end steps
  );

  state.elStoryContainer.appendChild(state.elStory);
  state.elMapContainer.appendChild(state.elStoryContainer);
}

async function buildBullets() {
  const state = getState();
  /**
   * Bullets
   */
  state.elBullets = el('div', {class: ['mx-story-step-bullets', 'noselect']});
  state.elBulletsContainer = el(
    'div',
    {
      class: ['mx-story-step-bullets-container', 'noselect']
    },
    state.elBullets
  );

  state.elMapControls.appendChild(state.elBulletsContainer);
}

/**
 * Handle broken images : empty canvas
 */
async function handleMissingImages() {
  const state = getState();
  const imgs = state.elStory.querySelectorAll('img');
  for (const img of imgs) {
    img.onerror = () => {
      const imgRect = img.getBoundingClientRect();
      const W = Math.ceil(imgRect.width);
      const H = Math.ceil(imgRect.height);
      const elCanvas = createCanvas(W, H);
      const elParent = img.parentElement;
      elParent.appendChild(elCanvas);
      img.remove();
    };
  }
}

const tf = {
  0: () => {
    return '';
  },
  1: (p) => {
    return 'translate3d(' + p + '%,0,0)';
  },
  2: (p) => {
    return 'translate3d(0,' + p + '%,0)';
  },
  3: (p) => {
    return 'translate3d(0,0,' + p + 'px)';
  },
  4: (p) => {
    p = p * 3.6;
    return 'rotate3d(1,0,0,' + p + 'deg)';
  },
  5: (p) => {
    p = p * 3.6;
    return 'rotate3d(0,1,0,' + p + 'deg)';
  },
  6: (p) => {
    p = p * 3.6;
    return 'rotate3d(0,0,1,' + p + 'deg)';
  },
  7: (p) => {
    p = p / 100 + 1;
    return 'scale(' + p + ')';
  }
};

/*
 * Set slide style translate based on dataset
 * @param {Object} o option
 * @param {Array} o.config Style config array
 * @param {Number} o.percent Percent of anim
 */
export function storySetTransform(o) {
  /* all transformations */
  const tt = [];
  /* Reverse percentage : start at 0, finish at 100 */
  let p = 100 - o.percent;

  for (const d of o.config) {
    /* limit percentage to start->end range*/
    if (p <= d.s) {
      p = d.s;
    }
    if (p >= d.e) {
      p = d.e;
    }

    /* modify the offset. Default middle is expected to be at 50%*/
    p = p - 50 + d.o;

    /* add a factor to transformation percentage */
    p = p * d.f;

    /* add to transformations */
    tt.push(tf[d.t](p));
  }

  return tt.join(' ');
}

export async function storyPlayStep(stepNum) {
  if (!isStoryPlaying()) {
    return;
  }
  const story = getStory();
  const state = getState();
  const settings = getSettings();
  const steps = path(story, 'steps', []);
  const elLegendContainer = state.buttonLegend.elPanelContent;
  const map = state.map;
  if (steps.length === 0) {
    return;
  }
  map.stop();
  mx.events.fire('story_step');
  /**
   * retrieve step information
   */
  const step = steps[stepNum];
  state.currentStep = stepNum;
  state.stepActive = stepNum;
  state.step = step;
  const pos = step.position;
  const anim = Object.assign(
    {},
    {
      duration: 1000,
      easing: 'easeIn',
      easing_power: 1,
      method: 'easeTo'
    },
    step.animation
  );
  const easing = easingFun({
    type: anim.easing,
    power: anim.easing_power
  });
  /**
   * Set base map mode
   */
  if (step.base_layer) {
    const actionAerial = step.base_layer.add_aerial ? 'show' : 'hide';
    const actionTerrain = step.base_layer.add_3d_terrain ? 'show' : 'hide';
    state.ctrlAerial.action(actionAerial);
    state.ctrlMode3d.action(actionTerrain);
  }

  /**
   * Fly to position
   */
  if (anim.method === 'fitBounds') {
    for (const p of ['w', 'e', 's', 'n']) {
      if (isEmpty(pos[p])) {
        pos[p] = 0;
        console.error(`Missing position ${p} to fitbounds`);
      }
    }
    map.fitBounds([pos.w, pos.s, pos.e, pos.n]);
    map.once('moveend', () => {
      map.easeTo({pitch: 0.0});
    });
  } else {
    map[anim.method]({
      duration: anim.duration,
      zoom: pos.z,
      easing: easing,
      bearing: pos.bearing,
      pitch: pos.pitch,
      center: [pos.lng, pos.lat]
    });
  }

  /**
   * Views set
   */
  const vStep = step.views.map((v) => v.view);
  const vVisible = getViewsLayersVisibles();
  const vToRemove = getArrayDiff(vVisible, vStep);
  const vToAdd = getArrayDiff(vStep, vVisible);

  /**
   * Add views if not alredy there
   */
  let i = 0;
  for (const v of vToAdd) {
    const vPrevious = vStep[i++ - 1] || mx.settings.layerBefore;
    await viewLayersAdd({
      idView: v,
      openView: false,
      addTitle: true,
      before: vPrevious,
      elLegendContainer
    });
  }

  /**
   * Remove views not used
   */
  for (const v of vToRemove) {
    await viewLayersRemove({
      idView: v,
      elLegendContainer
    });
  }

  await viewsLayersOrderUpdate({
    order: vStep
  });

  await viewsLegendsOrderUpdate({
    elContainer: elLegendContainer,
    order: vStep
  });

  /**
   * Update panels behaviour
   */
  await updatePanelBehaviour(state, settings, step);
}

/**
 * Update legend position
 * @param {Object} opt options
 * @param {Element} opt.elContainer Legend Container element
 * @param {Array} opt.order Array of view id to sort legend
 */

async function viewsLegendsOrderUpdate(opt) {
  let pos = 0;
  for (const idView of opt.order) {
    const elLegend = opt.elContainer.querySelector(
      `[data-id_view="${idView}"]`
    );
    if (elLegend) {
      elLegend.style.order = pos++;
    }
  }
}

async function updatePanelBehaviour(state, settings, step) {
  const dh = dashboardHelper;
  const idViews = path(step, 'views', []).map((v) => v.view || v);

  if (!isStoryPlaying()) {
    return;
  }

  /**
   * Set dashboard panel behaviour
   * -> used in buildDashboard()
   */
  const dDefault = 'default';
  const dClosed = 'closed';
  const dRoot = path(settings, 'dashboards_panel_behaviour', null);
  const dStep = path(step, 'dashboards_panel_behaviour', null);
  let dBehaviour;

  if (mx.settings.initClosedPanels) {
    dBehaviour = dClosed;
  } else if (dRoot && dRoot !== dDefault) {
    dBehaviour = dRoot;
  } else if (dStep && dStep !== dDefault) {
    dBehaviour = dStep;
  } else {
    dBehaviour = dDefault;
  }

  if (dBehaviour === 'disabled') {
    dh.rmInstance();
  } else {
    /**
     * Add widgets if any
     */
    for (const v of idViews) {
      await dh.viewAddWidgetsAsync(v);
    }
    const dashboard = dh.getInstance();

    /**
     * If a dashboard exists, apply behaviour
     */
    if (dashboard) {
      switch (dBehaviour) {
        case 'open':
          dashboard.show();
          break;
        case 'closed':
          dashboard.hide();
          break;
        default:
          /**
           * Get the the default from the first
           * view with config
           */
          for (const v of idViews) {
            const config = dh.viewConfigGet(v);
            if (config) {
              if (config.panel_init_close) {
                dashboard.hide();
              } else {
                dashboard.show();
              }
              break;
            }
          }
      }

      /**
       * Auto destroy e.g. if empty
       */

      dashboard.autoDestroy();
    }
  }

  /**
   * Set legend panel behaviour
   */
  const lDefault = 'default';
  const lClosed = 'closed';
  const lRoot = path(settings, 'legends_panel_behaviour', null);
  const lStep = path(step, 'legends_panel_behaviour', null);
  let lBehaviour;

  if (mx.settings.initClosedPanels) {
    lBehaviour = lClosed;
  } else if (lRoot && lRoot !== lDefault) {
    lBehaviour = lRoot;
  } else if (lStep && lStep !== lDefault) {
    lBehaviour = lStep;
  } else {
    lBehaviour = lDefault;
  }

  switch (lBehaviour) {
    case 'open':
      state.buttonLegend.open();
      break;
    case 'closed':
      state.buttonLegend.close();
      break;
    default:
      null;
  }
}

export function hasFocusOnMap() {
  const state = getState();
  let elActive = document.activeElement;
  const elMapC = state.elMapContainer;
  if (elActive === elMapC) {
    return true;
  }
  if (elActive.classList.contains('form-control')) {
    return false;
  }
  while (elActive) {
    elActive = elActive.parentElement;
    if (elActive === elMapC) {
      return true;
    }
  }
  return false;
}
