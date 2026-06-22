require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroUnmiserScheduler"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = package["license"]
  s.homepage     = "https://nitro.margelo.com"
  s.source       = { :git => "https://example.invalid/unmiser.git", :tag => "#{s.version}" }
  s.platforms    = { :ios => "13.0" }
  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
end
