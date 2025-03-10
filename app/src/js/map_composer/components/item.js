import mapboxgl from 'mapbox-gl';
import {el} from '../../el/src/index.js';
import {Box} from './box.js';
import {MapNorthArrow} from './north_arrow.js';

class Item extends Box {
  constructor(boxParent, config) {
    super(boxParent);
    const item = this;
    item.resizeAction = [];
    item.orig = config;
    item.type = config.type;
    item.title = 'item-' + item.type;
    item.editable = config.editable === true;

    item.onRemove = item.onRemove.bind(item);
    item.onResize = item.onResize.bind(item);

    item.init({
      class: 'mc-' + item.type,
      content: item.buildEl(),
      boxContainer: item.boxParent,
      boxBound: item.boxParent.boxParent,
      boundEdges: {top: true, left: true, bottom: false, right: false},
      draggable: true,
      resizable: true,
      removable: true,
      onRemove: item.onRemove,
      onResize: item.onResize,
      width: config.width || item.state.item_width,
      height: config.height || item.state.item_height
    });
  }

  /*
   * Build given item
   * @returns {Element} item's element
   */
  buildEl() {
    const item = this;
    const type = item.type;
    switch (type) {
      case 'map':
        return item.buildElMap();
      case 'title':
      case 'text':
        return item.buildElText();
      case 'legend':
      case 'element':
        return item.buildElNode();
      default:
        console.error(`type ${type} not known`);
    }
  }

  onResize() {
    const item = this;
    for (const a of item.resizeAction) {
      a();
    }
    item.displayDim();
  }

  onRemove() {
    const item = this;
    if (item.map) {
      item.map.remove();
    }
  }

  buildElNode() {
    const item = this;
    const elOut = el(
      'div',
      {
        dataset: {
          mc_editable: item.editable
        },
        class: ['mc-item', 'mc-item-element']
      },
      item.orig.element
    );
    return elOut;
  }

  buildElText() {
    const item = this;
    const text = el('span', item.orig.text).innerText; //quick html removal ?
    const elOut = el(
      'span',
      {
        class: ['mc-item', 'mc-item-text']
      },
      el(
        'div',
        {
          dataset: {
            mc_editable: item.editable
          }
        },
        el('p', text)
      )
    );
    return elOut;
  }

  buildElMap() {
    const item = this;
    const elOut = el('div', {
      dataset: {
        mc_editable: item.editable
      },
      class: ['mc-item', 'mc-item-map']
    });

    const mapOptions = Object.assign(
      {
        preserveDrawingBuffer: true,
        container: elOut,
        fadeDuration: 0,
        trackResize: false, // handled in mapcomposer
        renderWorldCopies: false
      },
      item.orig.options
    );

    item.map = new mapboxgl.Map(mapOptions);
    item.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');
    item.map.addControl(new MapNorthArrow(), 'top-right');
    item.resizeAction.push(() => {
      item.map.resize();
    });
    return elOut;
  }
}

export {Item};
