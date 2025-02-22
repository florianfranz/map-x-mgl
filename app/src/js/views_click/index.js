import {el, elSpanTranslate} from './../el_mapx/index.js';
import {isIconFont, isCanvas} from './../is_test_mapx';
import {path} from './../mx_helper_misc.js';
import {modal, modalConfirm} from './../mx_helper_modal.js';
import {FlashCircle} from './../icon_flash';
import {displayMetadataIssuesModal} from './../mx_helper_map_view_badges.js';
import {storyRead} from './../story_map/index.js';
import {viewToTableAttributeModal} from './../mx_helper_source_attribute_table.js';
import {viewToMetaModal} from './../mx_helper_map_view_metadata.js';
import {getDictItem} from './../mx_helper_language.js';
import {uploadGeoJSONModal} from './../mx_helper_upload_source.js';
import {modalMirror} from './../mirror_util';
import {ShareModal} from './../share_modal/index.js';
import {
  downloadViewSourceExternal,
  downloadViewGeoJSON,
  resetViewStyle,
  viewsCheckedUpdate,
  viewFilterToolsInit,
  getView,
  setProject,
  viewDelete,
  zoomToViewIdVisible,
  zoomToViewId
} from './../mx_helper_map.js';

export {handleViewClick};

async function handleViewClick(event) {
  try {
    if (event.target === event.currentTarget) {
      return;
    }

    const idMap = path(mx, 'settings.map.id');
    var elTarget = event.target;
    var t;

    elTarget =
      isIconFont(elTarget) || isCanvas(elTarget)
        ? elTarget.parentElement
        : elTarget;

    if (!elTarget) {
      return;
    }

    const dataset = elTarget.dataset;

    /*
     * tests
     */
    t = [
      {
        comment: 'target is the mirror helper button',
        test: dataset.tool_id === 'btn_mirror_url',
        action: modalMirror
      },
      {
        comment: 'target is a shiny action button',
        test: dataset.view_action_handler === 'shiny',
        action: function() {
          Shiny.onInputChange('mx_client_view_action', {
            target: dataset.view_action_target,
            action: dataset.view_action_key,
            time: new Date()
          });
        }
      },
      {
        comment: 'target is the show invalid/result metadata modal',
        test: dataset.view_action_key === 'btn_badge_warning_invalid_meta',
        action: function() {
          const results = JSON.parse(dataset.view_action_data);
          displayMetadataIssuesModal(results);
        }
      },
      {
        comment: 'target is a view badge',
        test: dataset.view_action_key === 'btn_badge_show_modal_badge',
        action: async () => {
          const type = dataset.view_action_data;
          modal({
            content: getDictItem(type),
            addBackground: true
          });
        }
      },
      {
        comment: 'target is the badge for temp shared view ',
        test: dataset.view_action_key === 'btn_badge_temp_shared',
        action: async () => {
          const type = dataset.view_action_data;
          modal({
            content: getDictItem(`${type}_desc`),
            addBackground: true
          });
        }
      },
      {
        comment: 'target is the home project button',
        test: dataset.view_action_key === 'btn_opt_home_project',
        action: async function() {
          const viewTarget = dataset.view_action_target;
          const view = getView(viewTarget);
          await setProject(view.project, {askConfirm: true});
        }
      },
      {
        comment: 'target is the share button',
        test: dataset.view_action_key === 'btn_opt_share',
        action: async function() {
          new ShareModal();
        }
      },
      {
        comment: 'target is the delete geojson button',
        test: dataset.view_action_key === 'btn_opt_delete_geojson',
        action: async () => {
          const resp = await modalConfirm({
            title: elSpanTranslate('delete_confirm_geojson_modal_title'),
            content: elSpanTranslate('delete_confirm_geojson_modal')
          });
          if (resp) {
            const arg = dataset;
            await viewDelete(arg.view_action_target);
          }
        }
      },
      {
        comment: 'target is the remove linked view button',
        test: dataset.view_action_key === 'btn_opt_remove_linked',
        action: async () => {
          const resp = await modalConfirm({
            title: elSpanTranslate('remove_confirm_temp_modal_title'),
            content: elSpanTranslate('remove_confirm_temp_modal')
          });
          if (resp) {
            const arg = dataset;
            await viewDelete(arg.view_action_target);
          }
        }
      },
      {
        comment: 'target is the get raster button',
        test: dataset.view_action_key === 'btn_opt_get_external',
        action: function() {
          const viewTarget = dataset.view_action_target;
          downloadViewSourceExternal({idView: viewTarget});
        }
      },
      {
        comment: 'target is the get geojson button',
        test: dataset.view_action_key === 'btn_opt_get_geojson',
        action: function() {
          const viewTarget = dataset.view_action_target;
          downloadViewGeoJSON({idView: viewTarget, mode: 'file'});
        }
      },
      {
        comment: 'target is the upload geojson button',
        test: dataset.view_action_key === 'btn_upload_geojson',
        action: function() {
          const idView = dataset.view_action_target;
          uploadGeoJSONModal(idView);
        }
      },
      {
        comment: 'target is the play button',
        test: dataset.view_action_key === 'btn_opt_start_story',
        action: function() {
          storyRead({
            id: idMap,
            idView: dataset.view_action_target,
            save: false
          });
        }
      },
      {
        comment: 'target is the zoom button',
        test: dataset.view_action_key === 'btn_opt_zoom_visible',
        action: function() {
          zoomToViewIdVisible({
            id: idMap,
            idView: dataset.view_action_target
          });
        }
      },
      {
        comment: 'target is zoom to extent',
        test: dataset.view_action_key === 'btn_opt_zoom_all',
        action: function() {
          zoomToViewId({
            id: idMap,
            idView: dataset.view_action_target
          });
        }
      },
      {
        comment: 'target is tool search',
        test: dataset.view_action_key === 'btn_opt_search',
        action: async () => {
          const elSearch = document.getElementById(
            dataset.view_action_el_target
          );
          const elSearchWait = elSearch.querySelector('.mx-search-tool-wait');
          const elSearchContent = elSearch.querySelector(
            '.mx-search-tool-content'
          );
          elSearch.classList.toggle('mx-hide');

          if (!elSearch.classList.contains('mx-hide')) {
            elSearchWait.classList.remove('mx-hide');
            elSearchContent.classList.add('mx-hide');
            const viewTarget = dataset.view_action_target;
            const view = getView(viewTarget);
            await viewFilterToolsInit(view);
            elSearchWait.classList.add('mx-hide');
            elSearchContent.classList.remove('mx-hide');
          }
        }
      },
      {
        comment: 'target is a legend filter',
        test: dataset.view_action_key === 'btn_legend_filter',
        allowDefault: true,
        action: function() {
          /*
           * After click on legend, select all sibling to check
           * for other values to filter using "OR" logical operator
           */
          const legendContainer = elTarget.closest('.mx-legend-box');
          const legendInputs = legendContainer.querySelectorAll('input');
          const idView = dataset.view_action_target;
          const view = getView(idView);
          const filter = ['any'];
          const rules = path(view, '_rulesLegend', []);
          for (const li of legendInputs) {
            if (li.checked) {
              const index = li.dataset.view_action_index * 1;
              const ruleIndex = rules[index];
              if (ruleIndex && ruleIndex.filter) {
                filter.push(ruleIndex.filter);
              }
            }
          }

          view._setFilter({
            type: 'legend',
            filter: filter
          });
        }
      },
      {
        comment: 'target is the label/input for the view to toggle',
        test: dataset.view_action_key === 'btn_toggle_view',
        allowDefault: true,
        action: function() {
          viewsCheckedUpdate();
        }
      },
      {
        comment: 'target is the reset button',
        test: dataset.view_action_key === 'btn_opt_reset',
        action: function() {
          resetViewStyle({
            idView: dataset.view_action_target
          });
        }
      },
      {
        comment: 'target is the attribute table button',
        test: dataset.view_action_key === 'btn_opt_attribute_table',
        action: function() {
          const idView = dataset.view_action_target;
          viewToTableAttributeModal(idView);
        }
      },
      {
        comment: 'target is the view meta button',
        test: dataset.view_action_key === 'btn_opt_meta',
        action: function() {
          const idView = dataset.view_action_target;
          viewToMetaModal(idView);
        }
      },
      {
        idAction: 'click_meta_raster_open',
        comment: 'target is the raster metadata link',
        test: dataset.view_action_key === 'btn_opt_meta_external',
        action: function() {
          const idView = dataset.view_action_target;
          const view = getView(idView);
          const link = path(view, 'data.source.urlMetadata');
          const lang = mx.settings.language;
          let title =
            path(view, `data.title.${lang}`) || path(view, 'data.title.en');

          if (!title) {
            title = idView;
          }
          const modalTitle = getDictItem('source_raster_tile_url_metadata');

          modal({
            title: modalTitle,
            id: 'modalMetaData',
            content: el(
              'div',
              el('b', modalTitle),
              ':',
              el(
                'a',
                {
                  href: link,
                  style: {
                    minHeight: '150px'
                  }
                },
                title
              )
            )
          });
        }
      }
    ];

    let found = false;

    for (let i = 0; i < t.length; i++) {
      if (!found && t[i].test === true) {
        found = true;
        new FlashCircle({
          x: event.clientX,
          y: event.clientY
        });
        const r = t[i].action();
        if (r instanceof Promise) {
          await Promise.all([r]);
        }

        if (dataset.view_action_key) {
          mx.events.fire({
            type: 'view_panel_click',
            data: {
              idView: dataset.view_action_target,
              idAction: dataset.view_action_key
            }
          });
        }

        if (!t[i].allowDefault) {
          /* Skip default */
          event.preventDefault();
          /* Stop bubbling */
          event.stopPropagation();
          /* Avoid other events */

          event.stopImmediatePropagation();
        }
      }
    }
  } catch (e) {
    console.error('handleViewClick', e);
  }
}
