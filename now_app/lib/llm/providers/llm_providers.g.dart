// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$llmSettingsServiceHash() =>
    r'808db9947076c8a683647413b476a06513bf5c1b';

/// See also [llmSettingsService].
@ProviderFor(llmSettingsService)
final llmSettingsServiceProvider =
    AutoDisposeProvider<LlmSettingsService>.internal(
      llmSettingsService,
      name: r'llmSettingsServiceProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$llmSettingsServiceHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LlmSettingsServiceRef = AutoDisposeProviderRef<LlmSettingsService>;
String _$llmConfigHash() => r'27e1632f18e01a5c747d5260a65dea8fbd89fa1a';

/// See also [llmConfig].
@ProviderFor(llmConfig)
final llmConfigProvider = AutoDisposeFutureProvider<LlmConfig>.internal(
  llmConfig,
  name: r'llmConfigProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$llmConfigHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LlmConfigRef = AutoDisposeFutureProviderRef<LlmConfig>;
String _$llmRepositoryHash() => r'4376cb024573667b6a5a631926cfa5d798bf4f3c';

/// See also [llmRepository].
@ProviderFor(llmRepository)
final llmRepositoryProvider =
    AutoDisposeFutureProvider<LlmRepository?>.internal(
      llmRepository,
      name: r'llmRepositoryProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$llmRepositoryHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LlmRepositoryRef = AutoDisposeFutureProviderRef<LlmRepository?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
