import Foundation
import WebKit

// Exercise Apple's actual content-rule compiler: an invalid rule would stop
// the app before its first page loads, even if an unsigned archive builds.
let parsed = try JSONSerialization.jsonObject(with: Data(AppContentRules.json.utf8)) as! [[String: Any]]
precondition(parsed.count == AppContentRules.domains.count)
let patterns = try AppContentRules.patterns.map { try NSRegularExpression(pattern: $0) }
func matches(_ url: String) -> Bool {
    patterns.contains { $0.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)) != nil }
}
for host in AppContentRules.domains {
    precondition(matches("https://" + host + "/script.js"))
    precondition(matches("https://sub." + host + "/script.js"))
}
for url in ["https://poe2-build-navi-jp.github.io/simulator/", "https://evilgooglesyndication.com/tracker", "https://googlesyndication.com.evil.test/script.js"] { precondition(!matches(url)) }
var finished = false
var compileError: Error?
var compiled: WKContentRuleList?
WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "poe2-startup-test-" + UUID().uuidString, encodedContentRuleList: AppContentRules.json) { list, error in
    compiled = list; compileError = error; finished = true
}
let deadline = Date().addingTimeInterval(30)
while !finished && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
guard finished, compiled != nil, compileError == nil else {
    fputs("FAIL: WebKit rejected app startup rules: \(String(describing: compileError))\n", stderr)
    exit(1)
}
print("PASS: actual WebKit startup-rule compilation and precise resource-domain matching.")
