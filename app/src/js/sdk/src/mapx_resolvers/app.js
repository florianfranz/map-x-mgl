import {MapxResolversStatic} from './static.js';

/**
 * MapX resolvers available in app only
 */
class MapxResolversApp extends MapxResolversStatic {
  /**
   * List resolvers methods
   * @return {Array} array of supported methods
   */
  get_sdk_methods() {
    const reg = new RegExp('^_');
    let methodsS = Object.getOwnPropertyNames(MapxResolversStatic.prototype);
    let methodsA = Object.getOwnPropertyNames(MapxResolversApp.prototype);
    methodsS = methodsS.splice(1, methodsS.length);
    methodsA = methodsA.splice(1, methodsA.length);
    methodsA.push(...methodsS);
    const methods = methodsA.filter((m) => !m.match(reg));
    return methods;
  }
  /**
   * Show the login modal window
   * @return {Boolean} done
   */
  show_modal_login() {
    const rslv = this;
    return rslv._shiny_input('btn_control', {value: 'showLogin'});
  }

  /**
   * Show view meta modal window
   * @return {Boolean} done
   */
  show_modal_view_meta(opt) {
    const rslv = this;
    opt = Object.assign({}, {idView: null}, opt);
    const view = rslv._h.getView(opt.idView);
    const valid = rslv._h.isView(view);
    if (valid) {
      rslv._h.viewToMetaModal(view);
      return true;
    } else {
      return rslv._err('err_view_invalid');
    }
  }

  /**
   * Launch chaos test : open / close views by batch for a minute
   * @return {Boolean} pass
   */
  async launch_chaos_test(opt) {
    const rslv = this;
    opt = Object.assign({}, {nBatch: 5, duration: 1000}, opt);
    const res = await rslv._h.chaosTest(opt);
    return res;
  }

  /**
   * Show view edit modal window
   * @return {Boolean} done
   */
  show_modal_view_edit(opt) {
    const rslv = this;
    const pass = rslv.check_user_role_breaker(['publishers', 'admins']);
    if (!pass) {
      return;
    }
    opt = Object.assign({}, {idView: null}, opt);
    const view = rslv._h.getView(opt.idView);
    const valid = rslv._h.isView(view);
    const editable = valid && view._edit === true;
    if (valid && editable) {
      rslv._shiny_input('mx_client_view_action', {
        action: 'btn_opt_edit_config',
        target: opt.idView
      });
      return true;
    } else {
      if (!editable && valid) {
        return rslv._err('err_view_not_editable');
      } else {
        return rslv._err('err_view_invalid');
      }
    }
  }

  /**
   * Show modal for tools
   * @param {Object} opt Options
   * @param {String} opt.tool Id of the tools
   * @param {Boolean} opt.list Return a list of tools
   * @return {Boolean | Array} Done or the list of tools
   */
  show_modal_tool(opt) {
    const rslv = this;
    opt = Object.assign({}, opt);
    const tools = {
      sharing_manager: {
        roles: ['public'],
        id: 'btnIframeBuilder',
        deprecated: true,
        new_resolver: 'open_modal_share'
      },
      view_new: {
        roles: ['publishers', 'admins'],
        id: 'btnAddView'
      },
      source_validate_geom: {
        roles: ['publishers', 'admins'],
        id: 'btnValidateSourceGeom'
      },
      source_overlap_utilities: {
        roles: ['publishers', 'admins'],
        id: 'btnAnalysisOverlap'
      },
      source_edit: {
        roles: ['publishers', 'admins'],
        id: 'btnEditSources'
      },
      source_metadata_edit: {
        roles: ['publishers', 'admins'],
        id: 'btnEditSourcesMetadata'
      },
      source_upload: {
        roles: ['publishers', 'admins'],
        id: 'btnUploadSourceApi'
      },
      db_temporary_connect: {
        roles: ['publishers', 'admins'],
        id: 'btnShowDbInfoSelf'
      },
      project_external_views: {
        roles: ['publishers', 'admins'],
        id: 'btnShowProjectExternalViews'
      },
      project_config: {
        roles: ['admins'],
        id: 'btnShowProjectConfig'
      },
      project_invite_new_member: {
        roles: ['admins'],
        id: 'btnShowInviteMember'
      },
      project_define_roles: {
        roles: ['admins'],
        id: 'btnShowRoleManager'
      }
    };

    if (opt.list) {
      return Object.keys(tools);
    }
    const conf = tools[opt.tool];

    if (!conf) {
      rslv._err('err_tool_not_found', {
        idTool: opt.tool || 'null'
      });
      return false;
    }

    const pass = rslv.check_user_role_breaker(conf.roles, {
      id: opt.tool
    });

    if (pass) {
      /**
       * Deprecated handling + fallback
       */
      if (conf.deprecated) {
        console.warn(
          `The tool ${opt.tool} is deprecated. Use ${conf.new_resolver}. instead`
        );
        return rslv[conf.new_method]();
      }

      /**
       * Trigger Shiny input
       */
      rslv._shiny_input(conf.id, {randomNumber: true});
      return true;
    }
    return false;
  }

  /**
   * Get user id
   * @return {Number} Current user id
   */
  get_user_id() {
    return mx.settings.user.id;
  }

  /**
   * Manually set MapX app token and reload the app.
   * This encrypted token is used to fingerprint
   * user, browser and time since the last log in. It could be generated using
   * MapX cryptography private key, or if not available, retrived from a live
   * session with mx.helpers.getToken() or with the SDK, get_mapx_token.
   * @param {String} Mapx valid encrypted token
   */

  set_token(str) {
    const rslv = this;
    if (str) {
      rslv._h.setToken(str);
    }
  }

  /**
   * Retrieve MapX token.
   * @return {String} MapX token.
   */

  get_token() {
    const rslv = this;
    return rslv._h.getToken();
  }
  /**
   * Get user roles
   * @return {Object} Current user roles
   */
  get_user_roles() {
    return mx.settings.user.roles;
  }
  /**
   * Check if user as given role
   * @param {Object} opt Options
   * @param {String|Array} opt.role Role(s) to check
   * @param {Boolean} opt.all all roles must match, else at least one
   * @return {Boolean} has role(s)
   */
  check_user_role(opt) {
    const rslv = this;
    opt = Object.assign({}, {role: ['public'], all: true}, opt);
    if (rslv._h.isString(opt.role)) {
      opt.role = [opt.role];
    }
    const all = opt.all === true;
    const roles = rslv.get_user_roles();
    return opt.role.reduce((a, c) => {
      const ok = roles.groups.indexOf(c) > -1;
      if (all) {
        return ok && a;
      } else {
        return a ? a : ok;
      }
    }, false);
  }
  /**
   * Check for any matching roles, send an error if it does not match
   * @param {Array} roleReq Array of required role. eg. ['members','admins']
   * @param {Object} opt Options
   * @param {Boolean} opt.reportError Report an error if no match (default true)
   * @param {Any} opt.id An identifier
   * @return {Boolean} matched
   */
  check_user_role_breaker(roleReq, opt) {
    const rslv = this;
    opt = Object.assign({}, {reportError: true, id: null}, opt);
    roleReq = roleReq || [];
    const pass = rslv.check_user_role({role: roleReq, all: false});
    if (!pass && opt.reportError) {
      rslv._err('err_tool_roles_not_match', {
        idTool: opt.id,
        roles: JSON.stringify(roleReq)
      });
    }
    return pass;
  }

  /**
   * Get user email
   * @return {String} Current user email ( if logged, null if not)
   */
  get_user_email() {
    return mx.settings.user.guest ? '' : mx.settings.user.email;
  }

  /**
   * Set project
   * @param {Object} opt options
   * @param {String} opt.idProject Id of the project to switch to
   * @return {Boolean} Done
   */
  async set_project(opt) {
    const rslv = this;
    opt = Object.assign({}, {idProject: null}, opt);
    return rslv._h.setProject(opt.idProject);
  }
  /**
   * Get projects list
   * @param {Object} opt Project fetching option
   * @return {Array} list of project for the current user, using optional filters
   */
  get_projects(opt) {
    const rslv = this;
    return rslv._h.fetchProjects(opt);
  }

  /**
   * Get current project id
   * @return {String} Current project id
   */
  get_project() {
    return mx.settings.project.id;
  }

  /**
   * Get list of collection for the current project
   * @param {Object} opt Options
   * @param {Boolean} opt.open Return only collections from open views
   * @return {Array} Array of collections names
   */
  get_project_collections(opt) {
    const rslv = this;
    return rslv._h.getProjectViewsCollections(opt);
  }

  /**
   * Test if the current user is guest
   * @return {Boolean} User is guest
   */
  is_user_guest() {
    return mx.settings.user.guest === true;
  }

  /**
   * Get views list state
   * @return {Array}
   */
  get_views_list_state() {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    return v.getState();
  }

  /**
   * Set views list filter (ui)
   * @param {Object} opt options
   * @param {Boolean} opt.reset Reset and remove all rules
   * @param {Array} opt.rules Array of filter object. e.g. {type:'text',value:'marine'}
   * @param {Boolean} opt.mode Set mode : 'intersection' or 'union';
   * @example
   * // reset all rules
   * mapx.ask('set_views_list_filter',{
   *    reset:true
   * })
   *
   * // Reset rules and filter views with a dashboard
   * mapx.ask('set_views_list_filter',{
   *    reset: true,
   *    rules : [{
   *    type : 'view_components,
   *    value:'dashboard'
   *    }]
   * })
   *
   * // All views with marine or earth in title or abstract or vector views or raster views
   * mapx.ask('set_views_list_filter',{
   *    rules:
   *     [
   *      {
   *           type: 'text',
   *           value: 'marine or earth'
   *       },
   *       {
   *           type: 'view_components',
   *           value: ['vt','rt']
   *       }
   *     ],
   *     mode: 'union'
   *   })
   * @return {Boolean} done
   */
  set_views_list_filters(opt) {
    const rslv = this;
    opt = Object.assign({}, {rules: [], mode: 'intersection'}, opt);
    const vf = rslv._h.getMapData().viewsFilter;
    vf.filterCombined(opt);
    return vf.getRules();
  }

  /**
   * Get views list filter rules
   * @return {Array} Rule list
   */
  get_views_list_filters() {
    const rslv = this;
    const vf = rslv._h.getMapData().viewsFilter;
    return vf.getRules();
  }
  /**
   * Get views current absolute order (without groups)
   * @return {Array}
   */
  get_views_order() {
    const rslv = this;
    return rslv._h.getViewsOrder();
  }

  /**
   * Set state / views list order, groups, etc. Opened view will be closed
   * @param {Object} opt Options
   * @param {Array} opt.state Mapx views list state
   * @return {Boolean} Done
   */
  set_views_list_state(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.setState({
      render: false,
      state: opt.state,
      useStateStored: false
    });
    return true;
  }

  /**
   * Set views list order
   * @param {Object} opt Options
   * @param {Boolean} opt.asc Asc
   * @param {String} opt.mode Mode : 'string' or 'date';
   * @return {Boolean} Done
   */
  set_views_list_sort(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    /**
     * Sort group -> trigger viewsLayersOrderUpdate -> fire 'layers_ordered'
     */
    const prom = new Promise((resolve) => {
      mx.events.on({
        type: 'layers_ordered',
        idGroup: 'sdk_resolver',
        callback: resolve
      });
    });
    v.sortGroup(null, opt);
    return prom;
  }

  /**
   * Test if views list is sorted
   * @param {Object} opt Options
   * @param {Boolean} opt.asc Asc
   * @param {String} opt.mode Mode : 'string' or 'date';
   * @return {Boolean} Sorted
   */
  is_views_list_sorted(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    opt = Object.assign({}, {check: true}, opt);
    return v.sortGroup(null, opt);
  }

  /**
   * Move view on top of its group
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @return {Boolean} Done
   */
  move_view_top(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetTop(opt.idView);
    return true;
  }
  /**
   * Move view on the bottom of its group
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @return {Boolean} Done
   */
  move_view_bottom(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetBottom(opt.idView);
    return true;
  }
  /**
   * Move view after anoter view
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @param {Sring} opt.idViewAfter
   * @return {Boolean} Done
   */
  move_view_after(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetAfter(opt.idView, opt.idViewAfter);
    return true;
  }
  /**
   * Move view before another view
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @param {Sring} opt.idViewBefore
   * @return {Boolean} Done
   */
  move_view_before(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetBefore(opt.idView, opt.idViewBefore);
    return true;
  }
  /**
   * Move view up
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @return {Boolean} Done
   */
  move_view_up(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetUp(opt.idView);
    return true;
  }
  /**
   * Move view down
   * @param {Object} opt Options
   * @param {Sring} opt.idView
   * @return {Boolean} Done
   */
  move_view_down(opt) {
    const rslv = this;
    const v = rslv._h.getMapData().viewsList;
    v.moveTargetDown(opt.idView);
    return true;
  }

  /**
   * Helper to work with shiny
   * @ignore
   */
  _shiny_input(id, opt) {
    if (mx.settings.mode.app) {
      opt = Object.assign({time: new Date()}, opt);
      if (opt.randomNumber) {
        opt = Math.ceil(Math.random() * 1000);
      }
      Shiny.onInputChange(id, opt);
    } else {
      return rslv._err('err_not_available_mode', {
        mode: JSON.stringify(mx.settings.mode)
      });
    }
    return true;
  }
}

export {MapxResolversApp};
