/*
  GF RGL Browser
  John J. Camilleri, 2012
*/
$(document).ready(function() {

    var loading = function(b){
        if (b)
            $("#loading").show();
        else
            $("#loading").hide();
    }

    var scrollToY = function(y, callback){
        $("html, body").animate({ scrollTop: y }, "slow", callback);
    }
    var scrollToTop = function() {
        scrollToY(0);
    }
    var scrollToCodeLine = function(lineNo) {
        showPanel("#code", function() {
            // Find exact line, using the classes generated by google prettify
            var obj = $("#code pre li.L"+(lineNo%10)+":eq("+Math.floor(lineNo/10)+")").prev();
            var y = obj.offset().top - 20;
            scrollToY(y, function(){
                highlight(obj);
            });
        });
    }
    var highlight = function(obj) {
        obj.css('background-color', "yellow");
        setTimeout(function(){
            obj.css('background-color', "");
        }, 1500);
    }

    var clearScope = function(msg) {
        $('#scope_list').empty();
        updateScopeCount();
        if (msg) {
            $('#scope_list').html("<em>"+msg+"</em>");
        }
    }
    var setScope = function(code) {
        $('#scope_list').html(code);
    }
    var clearCode = function(msg) {
        $('#code pre').empty();
        if (msg) {
            $('#codes pre').html("<em>"+msg+"</em>");
        }
    }
    var setCode = function(code) {
        $('#code pre').html(code);
        prettyPrint();
    }

    var current_language = undefined;
    var urlPrefix = "";
    var index;
    $.ajax({
        url: "index.json",
        dataType: "json",
        type: "GET",
        success: function(data) {
            index = data;
            urlPrefix = data['urlprefix'];

            // Initialize the language list
            var lang_select = $("<select>")
                .attr('id', 'language_select')
                .change(function(){
                    setLanguage($(this).val());
                })
                .appendTo("#languages")
            var language_list = data['languages'];
            for (i in language_list) {
                if (!i) continue;
                var lang = i;
                $('<option>')
                    .html(lang)
                    .appendTo(lang_select);
            }
            setLanguage("english");
            loading(false);
        },
        error: function(){
            alert("Error getting index. Try reloading page, or just give up.");
            loading(false);
        }
    });

    var setLanguage = function(lang){
        current_language = lang;
        $("#languages select").val(lang);
        initModules(lang);
    }

    // Initialize the module list
    var initModules = function(lang){
        index['languages'][lang] = index['languages'][lang].sort();
        $("#modules").empty();
        for (i in index['languages'][lang]) {
            var module = index['languages'][lang][i];
            if (!module) continue;
            $('<span>')
                .html(module)
                .addClass('button')
                .click((function(lang, module){
                    return function() {
                        loadFile(lang, module);
                    }
                })(lang, module))
                .appendTo("#modules");
        }
    };

    // Initialize the panels & tabs
    // obj can be just a plain selector or a jQuery object
    var showPanel = function(obj, callback){
        $(".panel").hide();
        $(obj).show(0, callback);
    }
    $(".panel").each(function(a,b){
        $("<a>")
            .addClass('tab')
            .addClass($(b).attr('id'))
            .attr('href', '#'+$(b).attr('id'))
            .html($(b).attr('id'))
            .click(function(){
                showPanel(b);
                return false;
            })
            .appendTo("#tabbar");
   });
    showPanel(".panel:first");

    var setTitle = function(s){
        $('#tabbar h2').html(s);
    }

    var updateScopeCount = function(){
        $('#scope_count').text( $("#scope_list tr:visible").length );
    }

    // Load both scope & source for a file
    var loadFile = function(lang, module, lineNo){
        setTitle(lang+"/"+module);
        loadTagsFile(module);
        loadSourceFile(lang, module, lineNo)
    }

    // Load a tags file
    var loadTagsFile = function(module) {
        clearScope();
        loading(true);
        $.ajax({
            url: "tags/"+module+".gf-tags",
            type: "GET",
            dataType: "text",
            success: function(data){
                data = data.replace(/^(\S+)\s(\S+)\s(.+)?$/gm, function(a,b,c,d){
                    var s = d.split("\t");
                    if (c == "indir") {
                        var name = s[2].slice(s[2].lastIndexOf('/')+1);
                        var anchor = '<a href="'+s[2]+'">'+name+'</a>';
                        return '<tr class="indir" name="'+b+'"><th>'+b+'</th><td>'+c+'</td><td>'+s[0]+'</td><td>'+s[1]+'</td><td>'+anchor+'</td><td></td></tr>'
                    } else {
                        var anchor = '<a href="'+s[0]+'">'+s[0]+'</a>';
                        return '<tr class="local" name="'+b+'"><th>'+b+'</th><td>'+c+'</td><td></td><td></td><td>'+anchor+'</td><td>'+s[1]+'</td></tr>'
                    }
                });
                setScope(data);
                $('#scope_list a').click(function(){
                    var href = $(this).attr('href');
                    var m = href.match(/([^\/]+)\/([^\/]+)\.(gf(-tags)?)(:\d+)?/);
                    if (m[3]=="gf") {
                        // Load both tags and source
                        var lineNo = m[5].slice(1);
                        loadFile(m[1], m[2], lineNo);
                    } else if (m[3]=="gf-tags") {
                        // Try and determine the language from the contents
                        checkSourceFile({
                            lang: current_language,
                            module: m[2],
                            onsuccess: function(){
                                loadFile(current_language, m[2]);
                                scrollToTop();
                            },
                            onerror: function(){
                                // Load just tags (we don't know source)
                                setTitle(m[2]+" (scope only)");
                                clearCode();
                                loadTagsFile(m[2]);
                                scrollToTop();
                            }
                        });
                    }
                    return false;
                });
                updateScopeCount();
                runFilter();
                loading(false);
            },
            error: function(data){
                clearScope("No scope available");
                loading(false);
            },
        });
    }

    // Just get the HTTP headers to see if a file exists
    var checkSourceFile = function(args) {
        $.ajax({
            url: urlPrefix + "/lib/src/"+args.lang+"/"+args.module+".gf",
            type: "HEAD",
            success: args.onsuccess,
            error: args.onerror
        });    
    }

    // Load a source module
    var loadSourceFile = function(lang, module, lineNo) {
        clearCode();
        loading(true);
        $.ajax({
            url: urlPrefix + "/lib/src/"+lang+"/"+module+".gf",
            type: "GET",
            dataType: "text",
            success: function(data){
                setCode(data);
                loading(false);
                if (lineNo) {
                    scrollToCodeLine(lineNo);
                }
            },
            error: function(data){
                clearCode("No code available");
                loading(false);
            }
        });
    }

    // Custom selector
    $.expr[':'].match = function(a,b,c) {
        var obj = $(a);
        var needle = c[3];
        var haystack = obj.attr('name');
        if (haystack == undefined)
            return false;
        if ($("#case_sensitive").is(":checked"))
            return haystack.indexOf(needle)>=0;
        else
            return haystack.toLowerCase().indexOf(needle.toLowerCase())>=0;
    };
    var runFilter = function() {
        // Hide anything which doesn't match
        var s = $("#search").val();
        loading(true);
        try {
            if (s) {
                $("#scope_list tr:match(\""+s+"\")").show();
                $("#scope_list tr:not(:match(\""+s+"\"))").hide();
            } else {
                $("#scope_list tr").show();
            }
            if ($("#show_local").is(":checked") ) {
                $("#scope_list tr.indir").hide();
            }
        } catch (error) {
            alert(error.message);
        }
        updateScopeCount();
        loading(false);
    }

    // Instant results
    $("#search").keyup(runFilter);
    $("#submit").hide();

    // Filter & clear buttons
    // $("#submit").click(runFilter);

    $("#search").keypress(function(e){
        var code = (e.keyCode ? e.keyCode : e.which);
        if(code == 13) { // Enter
            runFilter();
        }        
    });
    $("#clear").click(function(){
        $("#search").val('');
        runFilter();
    });
    $("#case_sensitive").change(runFilter);
    $("#show_all").change(runFilter);
    $("#show_local").change(runFilter);
});  
