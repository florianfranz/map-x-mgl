const def = {
  key: null,
  host: 'localhost',
  port: 80,
  protocol: '',
  container: 'idcontainer',
  language: 'en',
  index_template: 'views_{{language}}',
  index: 'views_en',
  link_pathname: '/static.html',
  hitsPerPage : 20,
  meili: {
    index_setting: {}
  },
  dates : {
      year_min : 1950,
      year_max : (new Date()).getFullYear()
  },
  attributes: {
    retrieve: [
      'view_modified_at',
      'view_created_at',
      'source_start_at',
      'source_end_at',
      'source_released_at',
      'source_modified_at',
      'view_title',
      'view_abstract',
      'source_title',
      'source_abstract',
      'source_keywords',
      'source_keywords_m49',
      'source_keywords_gemet',
      'source_notes',
      'project_title',
      'project_abstract',
      'view_id',
      'project_id',
      'view_type',
      'range_end_at_year',
      'range_start_at_year'
    ],
    date: [
      'source_start_at',
      'source_end_at'
    ],
    date_range: [
      'view_modified_at',
      'view_created_at',
      'source_released_at',
      'source_modified_at'
    ],
    text: [
      'view_title',
      'view_abstract',
      'source_title',
      'source_abstract',
      'source_keywords',
      'source_keywords_m49',
      'source_keywords_gemet',
      'source_notes',
      'project_title',
      'project_abstract',
      'view_id',
      'project_id',
      'view_type'
    ]
  },
  keywords: [
    {
      type: 'source_keywords',
      icon: 'fa-tag'
    },
    {
      type: 'source_keywords_gemet',
      icon: 'fa-leaf'
    },
    {
      type: 'source_keywords_m49',
      icon: 'fa-map-marker',
      subgroups: [
        {
          key: 'source_keywords_group_region',
          match: /wld|WLD|^m49_.*/,
          exclude: null
        },
        {
          key: 'source_keywords_group_country',
          match: /[a-zA-Z]{3}/,
          exclude: /wld|WLD/
        }
      ]
    },
    {
      type: 'view_type',
      icon: 'fa-file-o'
    }
  ]
};

export {def};
