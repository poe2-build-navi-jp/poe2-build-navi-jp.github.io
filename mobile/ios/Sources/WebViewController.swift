import UIKit
import WebKit
import UniformTypeIdentifiers

private final class BridgeRelay: NSObject, WKScriptMessageHandler {
    weak var owner: WebViewController?
    init(_ owner: WebViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { owner?.receive(message) }
}

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
    static let origin = "https://poe2-build-navi-jp.github.io"
    private var web: WKWebView!
    private var errorPanel = UIStackView()
    private var updateButton: UIBarButtonItem!
    private var backButton: UIBarButtonItem!
    private var forwardButton: UIBarButtonItem!
    private var importText: String?
    private var ready = false
    private var updateAvailable = false
    private var exportURL: URL?

    private func allowed(_ url: URL?) -> Bool {
        guard let url, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return parts.scheme == "https" && parts.host?.lowercased() == "poe2-build-navi-jp.github.io" && parts.user == nil && parts.password == nil && (parts.port == nil || parts.port == 443)
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        title = "POE2ビルドナビ"
        view.backgroundColor = .systemBackground
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(BridgeRelay(self), name: "Poe2Native")
        guard let source = Bundle.main.url(forResource: "host", withExtension: "js"), let bridge = try? String(contentsOf: source, encoding: .utf8) else {
            message("アプリのファイルを読み込めませんでした。アプリを再インストールしてください。")
            return
        }
        config.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        backButton = UIBarButtonItem(image: UIImage(systemName: "chevron.left"), style: .plain, target: self, action: #selector(back))
        backButton.accessibilityLabel = "前のページへ"
        forwardButton = UIBarButtonItem(image: UIImage(systemName: "chevron.right"), style: .plain, target: self, action: #selector(forward))
        forwardButton.accessibilityLabel = "次のページへ"
        toolbarItems = [backButton, forwardButton, .flexibleSpace(), UIBarButtonItem(title: "攻略", style: .plain, target: self, action: #selector(home)), .flexibleSpace(), UIBarButtonItem(title: "シミュ", style: .plain, target: self, action: #selector(simulator)), .flexibleSpace(), UIBarButtonItem(barButtonSystemItem: .action, target: self, action: #selector(share)), UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), style: .plain, target: self, action: #selector(more))]
        updateButton = UIBarButtonItem(title: "更新", style: .plain, target: self, action: #selector(refresh))
        navigationItem.rightBarButtonItem = updateButton
        let label = UILabel()
        label.text = "ページを読み込めませんでした。\n通信を確認して、もう一度お試しください。"
        label.numberOfLines = 0; label.textAlignment = .center
        let retry = UIButton(type: .system)
        retry.setTitle("再試行", for: .normal); retry.addTarget(self, action: #selector(retryLoad), for: .touchUpInside)
        errorPanel = UIStackView(arrangedSubviews: [label, retry]); errorPanel.axis = .vertical; errorPanel.spacing = 16
        errorPanel.backgroundColor = .systemBackground; errorPanel.translatesAutoresizingMaskIntoConstraints = false
        errorPanel.isHidden = true; view.addSubview(errorPanel)
        NSLayoutConstraint.activate([errorPanel.centerXAnchor.constraint(equalTo: view.centerXAnchor), errorPanel.centerYAnchor.constraint(equalTo: view.centerYAnchor), errorPanel.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -40)])
        NotificationCenter.default.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
        // App views do not run the website's advertising/analytics integrations.
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: AppContentRules.identifier, encodedContentRuleList: AppContentRules.json) { [weak self] list, error in
            guard let self else { return }
            guard let list else { self.message("通信設定を準備できませんでした。アプリを開き直してください。"); return }
            self.web.configuration.userContentController.add(list)
            self.load(Self.origin + "/simulator/")
        }
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    private func load(_ address: String) {
        guard let url = URL(string: address), allowed(url) else { return }
        errorPanel.isHidden = true
        var request = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30)
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        web.load(request)
    }
    private func run(_ code: String) {
        guard allowed(web?.url), ready else { message("ページの読み込みが終わってからお試しください。"); return }
        web.evaluateJavaScript(code + "; void 0") { [weak self] _, error in if let error { self?.message(error.localizedDescription) } }
    }
    private func quoted(_ value: String) -> String { String(data: try! JSONEncoder().encode(value), encoding: .utf8)! }
    @objc private func home() { load(Self.origin + "/") }
    @objc private func simulator() { load(Self.origin + "/simulator/") }
    @objc private func back() { if web.canGoBack { web.goBack() } }
    @objc private func forward() { if web.canGoForward { web.goForward() } }
    @objc private func resume() { if ready, allowed(web?.url) { web.evaluateJavaScript("window.Poe2Host?.checkForUpdate(); void 0", completionHandler: nil) } }
    @objc private func retryLoad() { load(allowed(web?.url) ? web.url!.absoluteString : Self.origin + "/simulator/") }
    @objc private func refresh() {
        let alert = UIAlertController(title: "最新版を読み込む", message: "保存済みの構成はそのまま残ります。入力途中の項目は、先にページ内の反映ボタンで保存してください。", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "あとで", style: .cancel))
        alert.addAction(UIAlertAction(title: "更新する", style: .default) { [weak self] _ in
            guard let self else { return }
            self.web.evaluateJavaScript("window.dispatchEvent(new Event('pagehide')); void 0") { _, _ in self.web.reloadFromOrigin() }
        })
        present(alert, animated: true)
    }
    private func sheet(_ items: [Any]) {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.barButtonItem = toolbarItems?.last
        present(controller, animated: true)
    }
    @objc private func share() { if let url = web.url, allowed(url) { sheet([url]) } }
    private func favorites() -> [[String: String]] { UserDefaults.standard.array(forKey: "native-favorites") as? [[String: String]] ?? [] }
    @objc private func more() {
        let menu = UIAlertController(title: "保存と共有", message: nil, preferredStyle: .actionSheet)
        menu.addAction(UIAlertAction(title: "このページをお気に入りに追加", style: .default) { [weak self] _ in
            guard let self, let url = self.web.url, self.allowed(url) else { return }
            var values = self.favorites().filter { $0["url"] != url.absoluteString }
            values.insert(["url": url.absoluteString, "title": String((self.web.title ?? "保存したページ").prefix(100))], at: 0)
            UserDefaults.standard.set(Array(values.prefix(50)), forKey: "native-favorites")
            self.message("お気に入りに保存しました。")
        })
        menu.addAction(UIAlertAction(title: "お気に入りを開く", style: .default) { [weak self] _ in self?.showFavorites() })
        menu.addAction(UIAlertAction(title: "構成・保存記事をバックアップ", style: .default) { [weak self] _ in self?.run("window.Poe2Host.exportBackup()") })
        menu.addAction(UIAlertAction(title: "アプリのバックアップを復元", style: .default) { [weak self] _ in
            guard let self, self.ready else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: true)
            picker.delegate = self; self.present(picker, animated: true)
        })
        menu.addAction(UIAlertAction(title: "非公式アプリについて", style: .default) { [weak self] _ in self?.message("Path of Exile 2の非公式ビルド支援アプリです。Grinding Gear Gamesの公式アプリではありません。記事・画像・ツリーはWeb版と共通です。\n\nWeb版とアプリの保存領域は別です。構成はWeb版の保存ファイルでも移せます。") })
        menu.addAction(UIAlertAction(title: "閉じる", style: .cancel))
        menu.popoverPresentationController?.barButtonItem = toolbarItems?.last
        present(menu, animated: true)
    }
    private func showFavorites() {
        let menu = UIAlertController(title: "お気に入り", message: favorites().isEmpty ? "ページを追加すると、ここからすぐ開けます。" : nil, preferredStyle: .actionSheet)
        for item in favorites() {
            guard let address = item["url"], allowed(URL(string: address)) else { continue }
            menu.addAction(UIAlertAction(title: item["title"] ?? "保存したページ", style: .default) { [weak self] _ in self?.load(address) })
        }
        menu.addAction(UIAlertAction(title: "閉じる", style: .cancel)); menu.popoverPresentationController?.barButtonItem = toolbarItems?.last
        present(menu, animated: true)
    }
    fileprivate func receive(_ message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "poe2-build-navi-jp.github.io", origin.port == 0 || origin.port == 443, allowed(web.url), let data = message.body as? [String: Any], let type = data["type"] as? String else { return }
        if type == "ready" { ready = true }
        else if type == "update" { updateAvailable = true; updateButton.title = "更新あり"; updateButton.accessibilityLabel = "Webサイトの更新をアプリに反映" }
        else if type == "error" { self.message(String((data["message"] as? String ?? "処理できませんでした。").prefix(300))) }
        else if type == "share", let text = data["text"] as? String { sheet([String(text.prefix(64000))]) }
        else if type == "file", let name = data["name"] as? String, let mime = data["mime"] as? String, ["application/json", "image/png", "image/jpeg"].contains(mime), let encoded = data["base64"] as? String, encoded.utf8.count <= 12 * 1024 * 1024, let bytes = Data(base64Encoded: encoded), bytes.count <= 8 * 1024 * 1024 {
            let safeName = String(name.unicodeScalars.map { CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-").contains($0) ? Character($0) : "_" }.prefix(100))
            guard !safeName.isEmpty, safeName != ".", safeName != ".." else { return }
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent(safeName)
                try bytes.write(to: file, options: .atomic)
                exportURL = directory
                let controller = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                controller.popoverPresentationController?.barButtonItem = toolbarItems?.last
                controller.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: directory) }
                present(controller, animated: true)
            } catch { self.message("ファイルを書き出せませんでした。") }
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first, ready, allowed(web.url) else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? Int.max
            guard size <= 8 * 1024 * 1024 else { message("8MB以内のバックアップを選んでください。"); return }
            let text = try String(contentsOf: url, encoding: .utf8)
            web.evaluateJavaScript("window.Poe2Host.inspectBackup(" + quoted(text) + ")") { [weak self] result, error in
                guard let self else { return }
                guard error == nil, let info = result as? [String: Any], let count = info["count"] as? Int else { self.message("このアプリで書き出したバックアップを選んでください。"); return }
                self.importText = text
                let alert = UIAlertController(title: "バックアップを復元", message: "\(count)件を読み込みます。同じ構成の保存は上書きされます。必要なら先に今のデータをバックアップしてください。", preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "やめる", style: .cancel) { _ in self.importText = nil })
                alert.addAction(UIAlertAction(title: "復元する", style: .default) { _ in self.restore() })
                self.present(alert, animated: true)
            }
        } catch { message("バックアップを読み込めませんでした。") }
    }
    private func restore() {
        guard let text = importText, allowed(web.url) else { return }
        importText = nil
        web.evaluateJavaScript("window.Poe2Host.restoreBackup(" + quoted(text) + ")") { [weak self] _, error in
            guard let self else { return }
            if error != nil { self.message("復元できませんでした。元のバックアップを保持して、端末の空き容量を確認してください。") }
            else { self.web.reloadFromOrigin() }
        }
    }
    private func message(_ text: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: "POE2ビルドナビ", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default)); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { ready = false; updateAvailable = false; errorPanel.isHidden = true }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        ready = true; errorPanel.isHidden = true; backButton.isEnabled = web.canGoBack; forwardButton.isEnabled = web.canGoForward; updateButton.title = updateAvailable ? "更新あり" : "更新"
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { ready = false; errorPanel.isHidden = false } }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { ready = false; errorPanel.isHidden = false } }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { ready = false; errorPanel.isHidden = false }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        if allowed(url) {
            if navigationAction.targetFrame == nil { decisionHandler(.cancel); load(url.absoluteString) } else { decisionHandler(.allow) }
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated, ["https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "POE2ビルドナビ", message: String(message.prefix(1000)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "POE2ビルドナビ", message: String(message.prefix(1000)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "やめる", style: .cancel) { _ in completionHandler(false) }); alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
}
