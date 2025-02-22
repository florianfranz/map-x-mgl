import {Button} from './button.js';
import screenfull from 'screenfull';
import {mapComposerModalAuto} from './../mx_helper_map_composer.js';
import {
  geolocateUser,
  getMap,
  getLayerNamesByPrefix
} from './../mx_helper_map.js';
import {toggleSpotlight} from './../mx_helper_map_pixop.js';
import {ShareModal} from './../share_modal/index.js';
import {
  storyMapLock,
  storyClose,
  isStoryPlaying
} from './../story_map/index.js';
import {modalMarkdown} from '../modal_markdown/index.js';

export function generateButtons() {
  return [
    new Button({
      key: 'btn_story_close',
      display: false,
      classesIcon: ['fa', 'fa-arrow-left'],
      action: storyClose
    }),
    new Button({
      key: 'btn_story_unlock_map',
      display: false,
      classesIcon: ['fa', 'fa-lock'],
      action: storyMapLock
    }),
    new Button({
      key: 'btn_zoom_in',
      classesIcon: ['fa', 'fa-plus'],
      action: () => {
        const map = getMap();
        map.zoomIn();
      }
    }),
    new Button({
      key: 'btn_zoom_out',
      classesIcon: ['fa', 'fa-minus'],
      action: () => {
        const map = getMap();
        map.zoomOut();
      }
    }),
    new Button({
      key: 'btn_map_rotate_left',
      classesIcon: ['fa', 'fa-rotate-left'],
      action: () => {
        const map = getMap();
        const b = map.getBearing();
        map.flyTo({bearing: b + 30});
      }
    }),
    new Button({
      key: 'btn_map_rotate_right',
      classesIcon: ['fa', 'fa-rotate-right'],
      action: () => {
        const map = getMap();
        const b = map.getBearing();
        map.flyTo({bearing: b - 30});
      }
    }),
    new Button({
      key: 'btn_north_arrow',
      classesIcon: ['mx-north-arrow'],
      action: () => {
        const map = getMap();
        map.easeTo({bearing: 0, pitch: 0});
      }
    }),
    new Button({
      key: 'btn_geolocate_user',
      classesIcon: ['fa', 'fa-map-marker'],
      action: geolocateUser
    }),
    new Button({
      key: 'btn_fullscreen',
      classesIcon: ['fa', 'fa-expand'],
      classesButton: ['btn-ctrl--item-no-mobile'],
      action: toggleFullScreen
    }),
    new Button({
      key: 'btn_theme_switch',
      classesIcon: ['fa', 'fa-adjust', 'fa-transition-generic'],
      action: toggleTheme
    }),
    new Button({
      key: 'btn_3d_terrain',
      classesIcon: ['mx-mountain'],
      action: function(cmd) {
        const btn = this;
        const map = getMap();
        cmd = typeof cmd === 'string' ? cmd : 'toggle';
        const enabled = toggleLayer({
          id: 'map_main',
          idLayer: 'terrain_sky',
          elButton: btn.elButton,
          action: cmd
        });
        const curPitch = map.getPitch();
        const storyPlaying = isStoryPlaying();
        if (!storyPlaying) {
          map.flyTo({pitch: enabled ? (curPitch > 0 ? curPitch : 60) : 0});
        }
        return enabled;
      }
    }),
    new Button({
      key: 'btn_theme_sat',
      classesIcon: ['fa', 'fa-plane'],
      action: function(cmd) {
        const btn = this;
        cmd = typeof cmd === 'string' ? cmd : 'toggle';
        const enabled = toggleLayer({
          id: 'map_main',
          idLayer: 'mapbox_satellite',
          elButton: btn.elButton,
          action: cmd
        });
        return enabled;
      }
    }),
    new Button({
      key: 'btn_overlap_spotlight',
      classesIcon: ['fa', 'fa-bullseye'],
      action: toggleSpotlight
    }),
    new Button({
      key: 'btn_map_composer',
      classesIcon: ['fa', 'fa-map-o'],
      classesButton: ['btn-ctrl--item-no-mobile'],
      action: mapComposerModalAuto
    }),
    new Button({
      key: 'btn_about',
      classesIcon: ['fa', 'fa-info'],
      action: async () => {
        return modalMarkdown({
          title: 'Disclaimer',
          txt: await import('./../../md/disclaimer.md')
        });
      }
    }),
    new Button({
      key: 'btn_share',
      classesIcon: ['fa', 'fa-share-alt'],
      action: () => {
        new ShareModal();
      }
    }),
    new Button({
      key: 'btn_bug_report',
      classesIcon: ['fa', 'fa-bug'],
      action: () => {
        window.open(mx.settings.links.repositoryIssues, '_blank');
      }
    })
  ];
}

/**
 * Helpers
 * NOTE: If use 'this', function must be named. Anonymous,
 * even 'bound', do not have 'this' in event callback;
 */

function toggleFullScreen() {
  const btn = this;
  const enabled = !!btn._fullscreen;
  const cl = btn.elButton.classList;
  if (enabled) {
    cl.add('fa-expend');
    cl.remove('fa-compress');
    screenfull.exit();
    btn._fullscreen = false;
  } else {
    cl.remove('fa-expend');
    cl.add('fa-compress');
    screenfull.request();
    btn._fullscreen = true;
  }
}

function toggleTheme() {
  const elIcon = this.elButton.querySelector('.fa');
  elIcon.classList.toggle('fa-rotate-180');
  mx.theme.toggleDarkMode();
}

/**
 * Toggle visibility for existing layer in style
 * TODO: This is quite messy : simplify, generalize
 * @param {Object} opt options
 * @param {String} opt.idLayer Layer id to toggle
 * @param {Element} opt.elButton Button element to add 'active' class
 * @param {String} opt.action hide, show, toggle
 * @return {String} Toggled
 */
function toggleLayer(opt) {
  const def = {
    action: 'toggle'
  };
  opt = Object.assign({}, def, opt);
  const altLayers = [];
  const map = getMap();
  const btn = opt.elButton;
  const layer = map.getLayer(opt.idLayer);
  const isAerial = opt.idLayer === 'mapbox_satellite'; // hide also shades...
  const isTerrain = opt.idLayer === 'terrain_sky'; // hide shade + show terrain...
  const isVisible = layer.visibility === 'visible';
  const reqShow = opt.action === 'show';
  const reqHide = opt.action === 'hide';
  const reqToggle = opt.action === 'toggle';
  const toShow = reqToggle ? !isVisible : reqShow || !reqHide;

  if (isAerial || isTerrain) {
    /**
     * Special case : aerial and terrain mode should not have
     * hillshading or bathymetry.
     */
    altLayers.push(...getLayerNamesByPrefix({prefix: 'hillshading'}));
    altLayers.push(...getLayerNamesByPrefix({prefix: 'bathymetry'}));
  }

  map.setLayoutProperty(opt.idLayer, 'visibility', toShow ? 'visible' : 'none');

  for (let id of altLayers) {
    map.setLayoutProperty(id, 'visibility', toShow ? 'none' : 'visible');
  }
  if (isTerrain) {
    map.setTerrain(toShow ? {source: 'mapbox_dem', exaggeration: 1} : null);
  }
  if (btn) {
    btn.classList[toShow ? 'add' : 'remove']('active');
  }
  return toShow;
}
