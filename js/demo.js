var KelbyOne = KelbyOne || {
    host: 'http://kelbynew.staging.wpengine.com',
    namespace: 'api/v1',
    device: {
        app_version: '0.1',
        hardware_model: Detectizr.device.model,
        operating_system: Detectizr.os.version
    },
    hasAuth: false,
    cache: [],
    activeCategory: null
}

KelbyOne.load = function(category, course) {
    var self = this;
    if (!self.hasAuth()) {
        return self.showLoginForm();
    }

    self.retreive([], 'categories');
    console.info(getURLIndex(), 'load');
    // load category on reload
    if (getURLIndex()) {
        var data = {
            category_id: getURLIndex()
        }
        self.retreive(data, 'category-classes');
        self.activeCategory = getURLIndex();
    } else {
        self.showCategoryMenu();
    }

    $('.toggle').on('click', function() {
        self.toggleCategoryMenu()
    })

}

KelbyOne.hasAuth = function() {
    return getCookie('_ko-session_token');
}

KelbyOne.showCategoryMenu = function() {
    $('body').addClass('show-categories');
}

KelbyOne.hideCategoryMenu = function() {
    $('body').removeClass('show-categories');
}

KelbyOne.toggleCategoryMenu = function() {
    $('body').toggleClass('show-categories');
}

KelbyOne.bindCategoryClick = function() {
    var self = this;
    var ev = 'ontouchstart' in window ? 'touchstart' : 'click';

    $('#categories a').on(ev, function(ev) {
        self.hideClassDetails();
        self.hideCategoryMenu();
        var data = {
            category_id: $(this).attr('href').replace('#', "")
        }

        self.setActiveCategory(data.category_id);
        self.retreive(data, 'category-classes');
    });
}

KelbyOne.setActiveCategory = function(id) {
    var self = this;
    self.activeCategory = id;

    $('.active').removeClass('active');
    $('#categories a[href="#' + id + '"]').parents('.item').addClass('active');
}

KelbyOne.bindCourseClick = function() {
    var self = this;
    var ev = 'ontouchstart' in window ? 'touchstart' : 'click';

    $('#category-classes a').on(ev, function(ev) {
        ev.preventDefault();
        self.showClassDetails($(this).attr('href').replace('#', ""))
    });
}

KelbyOne.showClassDetails = function(id) {
    var self = this;
    var ev = 'ontouchstart' in window ? 'touchstart' : 'click';
    console.info(self.cache[self.activeCategory], self.activeCategory, id);

    var active = self.cache[self.activeCategory].filter(function(item) {
        return item.class_id === parseInt(id);
    });
    var template = $('#course .info');

    template.find('.name').html(active[0].display_name);
    $('#course').find('img.primary').attr('src', active[0].image_url);
    template.find('.description').html(active[0].description);
    template.find('.lessons .count').html(active[0].number_of_lessons);

    var instructorTemplate = $('.instructor.template');

    for (var i = 0; i < active[0].instructors.length; i++) {
        var clone = instructorTemplate.clone();
        var instructor = active[0].instructors[i];

        clone.find('.name').html(instructor.display_name);
        clone.find('img').attr('src', instructor.image_url);
        clone.find('.description').html(instructor.biography);

        clone.removeClass('template')

        $('.instructors').append(clone);
    }

    $('body').addClass('show-course');
    $('#course .close').on(ev, function() {
        self.hideClassDetails();
    })
}

KelbyOne.hideClassDetails = function() {
    var ev = 'ontouchstart' in window ? 'touchstart' : 'click';
    $('body').removeClass('show-course');
    $('#course').find('.instructor:not(.template)').remove();
    $('#course .close').off(ev);
}

KelbyOne.retreive = function(data, resource) {
    var self = this;
    var category;

    if (typeof data === 'undefined') {
        console.warn('Data must be specified for all ajax requests')
    }

    if (typeof resource === 'undefined') {
        console.warn('Endpoint must be specified for all ajax requests')
    }

    // double check auth just to be safe
    if (!self.hasAuth()) {
        return self.showLoginForm();
    }

    // load from cache if it exists
    if (data.category_id && self.cache[data.category_id]) {
        return self.formatResponse(resource, self.cache[data.category_id]);
    }

    var url = buildUrl(resource);
    var data = {
        device: self.device,
        request_data: data
    }

    data.session_token = getCookie('_ko-session_token');

    $.ajax({
        type: "POST",
        url: url,
        data: JSON.stringify(data),
        contentType: 'application/json',
        beforeSend: function() {
            // Clear existing results
            $('#' + resource).find('.item:not(.template)').remove();
            $('#' + resource).find('.results').addClass('loading');
        },
        success: function(response) {
            if ('2' === response.status) {
                // cache the results for future access
                if (data.request_data.category_id) {
                    self.cache[data.request_data.category_id] = response.response_data;
                }
                return self.formatResponse(resource, response.response_data);
            }
            return self.showError(response.error_message);
        }
    }).done(function() {
        $('#' + resource).find('.results').removeClass('loading');
    });
}

KelbyOne.authorize = function(data, resource) {
    // although this is very similar to retreive, I thought I would keep this separate to ensure
    // there aren't any further custom events or actions would need to be handled on login :/
    var self = this;

    if (typeof data === 'undefined') {
        console.warn('Data must be specified for all ajax requests')
    }

    if (typeof resource === 'undefined') {
        console.warn('Endpoint must be specified for all ajax requests')
    }

    var url = buildUrl(resource);
    var data = {
        device: self.device,
        request_data: data
    }

    $.ajax({
        type: "POST",
        url: url,
        data: JSON.stringify(data),
        contentType: 'application/json',
        beforeSend: function() {
            // lock the form to avoid multiple submit
            $('#login').find('input').attr('disabled', true);
        },
        success: function(response) {
            if ('2' === response.status) {
                setCookie('_ko-session_token', response.response_data.session_token);
                self.retreive([], 'categories');
                if (!getURLIndex()) {
                    self.showCategoryMenu();
                }

                return self.hideLoginForm();
            }
            return self.showError(response.error_message);
        }
    }).done(function() {
        $('#login').find('input').attr('disabled', false);
    });
}

KelbyOne.formatResponse = function(resource, data) {
    var self = this;
    var id;
    var $wrapper = $('#' + resource);
    // Clear existing results
    $wrapper.find('.item:not(.template)').remove();

    for (var i = 0; i < data.length; i++) {
        var template = $wrapper.find('.item.template').clone();
        var item = data[i];
        template.attr('data-name', item.display_name);
        if (item.category_id) {
            id = item.category_id;
        }
        if (item.class_id) {
            id = item.class_id;
        }
        template.find('a').attr('href', '#' + id);
        template.find('.name').html(item.display_name);
        template.find('img').attr('src', item.image_url);
        template.find('.description').html(item.description);
        template.removeClass('template');
        $wrapper.find('.results').append(template);
    };

    if ('categories' == resource) {
        if (getURLIndex()) {
            self.setActiveCategory(getURLIndex());
        }
        self.bindCategoryClick();
    }

    if ('category-classes' == resource) {
        self.bindCourseClick();
    }
}

KelbyOne.showError = function(message) {
    $('#error').html(message);
}

KelbyOne.bindLoginSubmit = function() {
    var self = this;
    $('#login').on('submit', function(ev) {
        ev.preventDefault();
        var data = normalizeFormData($('#login').serializeArray());
        self.authorize(data, 'login');
    });
}

KelbyOne.showLoginForm = function() {
    var self = this;
    history.pushState("", document.title, window.location.pathname + window.location.search);
    $('body').addClass('show-overlay');
    self.bindLoginSubmit();
}

KelbyOne.hideLoginForm = function() {
    var self = this;
    $('body').removeClass('show-overlay');
}

/*
      Helper Functions.
**************************************/
function normalizeFormData(data) {
    var normalized = data.reduce(function(obj, item) {
        obj[item.name] = item.value;
        return obj;
    }, {});
    return normalized;
}

function buildUrl(resource) {
    return KelbyOne.host + '/' + KelbyOne.namespace + '/' + resource;
}

function setCookie(key, value) {
    var expires = new Date();
    expires.setTime(expires.getTime() + (1 * 24 * 60 * 60 * 1000));
    document.cookie = key + '=' + value + ';expires=' + expires.toUTCString();
}

function getCookie(key) {
    var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
    return keyValue ? keyValue[2] : null;
}

function getURLIndex() {
    return parseInt(window.location.hash.replace('#', ""));
}

KelbyOne.load();



$('#sort').on('click', function(ev) {
    $("#category-classes .results").each(function() {
        $(this).html($(this).children('li').sort(function(a, b) {
            return ($(b).data('name')) < ($(a).data('name')) ? 1 : -1;
        }));
    });
    KelbyOne.bindCourseClick();
});
