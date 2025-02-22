function loadRepoView() {
    $("#sectionRepo .repo-details").hide()
    $("#sectionRepo").show()

    $("#repoAddModal input[name=name]").val(getHashParam("suggestRepo"))
    $("#repoAddModal input[name=url]").val(getHashParam("suggestRepoUrl"))

    if (getHashParam("suggestRepo")) {
        $("#sectionRepo .repo-list .btn").click()
    }

    $.getJSON("/api/helm/repositories").fail(function (xhr) {
        reportError("Failed to get list of repositories", xhr)
        sendStats('Get repo', {'status': 'fail'});
    }).done(function (data) {
        const items = $("#sectionRepo .repo-list ul").empty()
        data.sort((a, b) => (a.name > b.name) - (a.name < b.name))

        data.forEach(function (elm) {
            let opt = $('<li class="mb-2"><label><input type="radio" name="repo" class="me-2"/><span></span></label></li>');
            opt.attr('title', elm.url)
            opt.find("input").val(elm.name).text(elm.name).data("item", elm)
            opt.find("span").text(elm.name)
            items.append(opt)
        })

        if (!data.length) {
            items.text("No repositories found, try adding one")
        }
        sendStats('Get repo', {'status': 'success', length: data.length});
        items.find("input").click(function () {
            $("#inputSearch").val('')
            const self = $(this)
            const elm = self.data("item");
            setHashParam("repo", elm.name)
            $("#sectionRepo .repo-details").show()
            $("#sectionRepo .repo-details h2").text(elm.name)
            $("#sectionRepo .repo-details .url").text(elm.url)

            $("#sectionRepo .btn-remove").prop("disabled", elm.url.startsWith('file://'))

            $("#sectionRepo .repo-details ul").html('<span class="spinner-border spinner-border-sm mx-1" role="status" aria-hidden="true"></span>')
            $.getJSON("/api/helm/repositories/" + elm.name).fail(function (xhr) {
                reportError("Failed to get list of charts in repo", xhr)
            }).done(function (data) {
                $("#sectionRepo .repo-details ul").empty()
                data.forEach(function (elm) {
                    const li = $(`<li class="row p-2 rounded">
                        <h6 class="col-3 py-2">` + elm.name.split('/').pop() + `</h6>
                        <div class="col py-2">` + elm.description + `</div>
                        <div class="col-1 py-2">` + elm.version + `</div>
                        <div class="col-1 action text-nowrap"><button class="btn btn-sm border-secondary bg-white">Install</button></div>
                    </li>`)

                    if (elm.icon) {
                        li.find("h6").prepend('<img src="' + elm.icon + '" class="me-1" style="height: 1rem"/>')
                    }

                    li.data("item", elm)

                    if (elm.installed_namespace) {
                        li.find("button").text("View").addClass("btn-success").removeClass("bg-white")
                        li.find(".action").prepend("<i class='bi-check-circle-fill me-1 text-success' title='Already installed'></i>")
                    }

                    li.click(repoChartClicked)

                    $("#sectionRepo .repo-details ul").append(li)
                })
            })
        })

        if (getHashParam("repo")) {
            items.find("input[value='" + getHashParam("repo") + "']").click()
        } else {
            items.find("input").first().click()
        }
    })
}

$("#inputSearch").keyup(function () {
    let val = $(this).val().toLowerCase();

    $(".charts li").each(function () {
        let chartName = $(this.firstElementChild).text().toLowerCase()
        if (chartName.indexOf(val) >= 0) {
            $(this).show()
        } else {
            $(this).hide()
        }
    })
})

$("#sectionRepo .repo-list .btn").click(function () {
    setHashParam("suggestRepo", null)
    setHashParam("suggestRepoUrl", null)
    const myModal = new bootstrap.Modal(document.getElementById('repoAddModal'), {});
    myModal.show()
})

$("#repoAddModal .btn-confirm").click(function () {
    $("#repoAddModal .btn-confirm").prop("disabled", true).prepend('<span class="spinner-border spinner-border-sm mx-1" role="status" aria-hidden="true"></span>')
    $.ajax({
        type: 'POST',
        url: "/api/helm/repositories",
        data: $("#repoAddModal form").serialize(),
    }).fail(function (xhr) {
        reportError("Failed to add repo", xhr)
    }).done(function () {
        setHashParam("repo", $("#repoAddModal form input[name=name]").val())
        window.location.reload()
    })
})

$("#sectionRepo .btn-remove").click(function () {
    if (confirm("Confirm removing repository?")) {
        $.ajax({
            type: 'DELETE',
            url: "/api/helm/repositories/" + $("#sectionRepo .repo-details h2").text(),
        }).fail(function (xhr) {
            reportError("Failed to add repo", xhr)
        }).done(function () {
            setHashParam("repo", null)
            window.location.reload()
        })
    }
})

$("#sectionRepo .btn-update").click(function () {
    $("#sectionRepo .btn-update i").removeClass("bi-arrow-repeat").append('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>')
    $.ajax({
        type: 'POST',
        url: "/api/helm/repositories/" + $("#sectionRepo .repo-details h2").text(),
    }).fail(function (xhr) {
        reportError("Failed to add repo", xhr)
    }).done(function () {
        window.location.reload()
    })
})

function repoChartClicked() {
    const self = $(this)
    const elm = self.data("item")
    if (elm.installed_namespace) {
        setHashParam("section", null)
        setHashParam("namespace", elm.installed_namespace)
        setHashParam("chart", elm.installed_name)
        window.location.reload()
    } else {
        const contexts = $("body").data("contexts")
        const ctxFiltered = contexts.filter(obj => {
            return obj.Name === getHashParam("context")
        });
        const contextNamespace = ctxFiltered.length ? ctxFiltered[0].Namespace : ""
        elm.repository = $("#sectionRepo .repo-details h2").text()
        popUpUpgrade(elm, contextNamespace)
    }
}