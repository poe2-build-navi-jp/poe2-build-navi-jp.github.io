import Foundation

enum AppContentRules {
    static let identifier = "poe2-app-content-v2"
    static let domains = ["googlesyndication.com", "doubleclick.net", "googleadservices.com", "fundingchoicesmessages.google.com", "googletagmanager.com", "google-analytics.com"]
    // WebKit content filters support a subset of regular expressions: one rule
    // per host avoids the unsupported alternation operator in the URL matcher.
    static var patterns: [String] {
        domains.map { "^https?://([^/]*\\.)?" + $0.replacingOccurrences(of: ".", with: "\\.") + "/" }
    }
    static var json: String {
        let entries = patterns.map { ["trigger": ["url-filter": $0], "action": ["type": "block"]] }
        return String(data: try! JSONSerialization.data(withJSONObject: entries), encoding: .utf8)!
    }
}
