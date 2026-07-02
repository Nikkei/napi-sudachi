#![deny(clippy::all)]

use napi::Result as NapiResult;
use napi_derive::napi;

use std::boxed::Box;
use std::env;
use std::path::PathBuf;
use std::pin::Pin;
use sudachi::analysis::{stateful_tokenizer::StatefulTokenizer, Mode};
use sudachi::config::Config;
use sudachi::dic::dictionary::JapaneseDictionary;
use sudachi::prelude::*;

/// Build sudachi config.
/// You can set environment variables to override the default values.
///
/// ## Required
/// * NAPI_SUDACHI_ROOT: package root directory path
///   * When called from JavaScript, automatically set to the directory containing package.json
///
/// ## Optional
/// * SUDACHI_CONFIG_FILE: config file path
/// * SUDACHI_RESOURCE_DIR: resource directory path
/// * SUDACHI_DICT_PATH: dictionary path
/// * SUDACHI_USER_DICT: user dictionary path
fn load_config() -> Result<Config, Box<SudachiError>> {
  let config_file = env::var("SUDACHI_CONFIG_FILE").ok().map(PathBuf::from);
  let resource_dir = env::var("SUDACHI_RESOURCE_DIR").ok().map(PathBuf::from);
  let dictionary_path = env::var("SUDACHI_DICT_PATH").ok().map(PathBuf::from);
  let user_dict_path = env::var("SUDACHI_USER_DICT").ok().map(PathBuf::from);

  // SUDACHI_RESOURCE_DIRが設定されていない場合は、NAPI_SUDACHI_ROOTを使用
  let final_resource_dir = resource_dir.unwrap_or_else(|| {
    if let Ok(package_root) = env::var("NAPI_SUDACHI_ROOT") {
      PathBuf::from(package_root).join("resources")
    } else {
      panic!("NAPI_SUDACHI_ROOT is not set");
    }
  });
  let final_config_file = config_file.unwrap_or_else(|| final_resource_dir.join("sudachi.json"));
  let final_dictionary_path =
    dictionary_path.unwrap_or_else(|| final_resource_dir.join("system.dic"));

  let mut config = Config::new(
    Some(final_config_file),
    Some(final_resource_dir),
    Some(final_dictionary_path),
  )
  .map_err(|e| Box::new(SudachiError::ConfigError(e)))?;

  // 環境変数でuser_dictが指定されている場合は追加
  if let Some(user_dict) = user_dict_path {
    if !user_dict.exists() {
      panic!(
        "SUDACHI_USER_DICT path does not exist: {}",
        user_dict.display()
      );
    }
    config.user_dicts.push(user_dict);
  }

  Ok(config)
}

/// Unit to split text
///
/// * A: short mode
/// * B: middle mode
/// * C: long mode (default)
#[napi]
pub struct SplitMode;

#[napi]
impl SplitMode {
  #[napi]
  pub fn a() -> u32 {
    0
  }

  #[napi]
  pub fn b() -> u32 {
    1
  }

  #[napi]
  pub fn c() -> u32 {
    2
  }
}

/// Morpheme properties based on `sudachi::analysis::morpheme::Morpheme`,
/// some functions are converted to properties that can be used in JavaScript.
#[napi(object)]
pub struct Morpheme {
  /// the begin index in bytes of the morpheme in the original text
  pub begin: u32,
  /// the end index in bytes of the morpheme in the original text
  pub end: u32,
  /// the codepoint offset of the morpheme begin in the original text
  pub begin_c: u32,
  /// the codepoint offset of the morpheme end in the original text
  pub end_c: u32,
  /// the index of this morpheme
  pub index: u32,
  /// a substring of the original text which corresponds to the morpheme
  pub surface: String,
  /// the part of speech id
  pub part_of_speech_id: u16,
  /// the part of speech of the morpheme
  pub part_of_speech: Vec<String>,
  /// the form normalizing inconsistent spellings and inflected forms
  pub normalized_form: String,
  /// word's lemma and '終止形' in Japanese.
  pub dictionary_form: String,
  /// Japanese syllabaries 'カタカナ'
  pub reading_form: String,
  /// dictionary id, -1 if the morpheme is oov
  pub dictionary_id: i32,
}

/// Tokenizer class for tokenizing text into morphemes
#[napi]
pub struct Tokenizer {
  dict: Pin<Box<JapaneseDictionary>>,
}

impl Default for Tokenizer {
  fn default() -> Self {
    Self::new()
  }
}

#[napi]
impl Tokenizer {
  /// create a new Tokenizer instance
  #[napi(constructor)]
  pub fn new() -> Self {
    let config = load_config()
      .map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to load config: {}", e),
        )
      })
      .expect("Failed to load config");
    let dict = JapaneseDictionary::from_cfg(&config)
      .map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to load dictionary: {}", e),
        )
      })
      .expect("Failed to load dictionary");

    Self {
      dict: Box::pin(dict),
    }
  }

  /// tokenize text into morphemes
  #[napi]
  pub fn tokenize(&self, text: String, mode: Option<u32>) -> NapiResult<Vec<Morpheme>> {
    let sudachi_mode = match mode.unwrap_or(2) {
      0 => Mode::A,
      1 => Mode::B,
      2 => Mode::C,
      _ => Mode::C, // default to Mode C
    };

    // stateful tokenizer を作成
    let mut analyzer = StatefulTokenizer::create(&*self.dict, false, sudachi_mode);

    // 形態素解析を実行し、MorphemeListを返却
    analyzer.reset().push_str(&text);
    analyzer.do_tokenize().map_err(|e| {
      napi::Error::new(
        napi::Status::GenericFailure,
        format!("Tokenization failed: {}", e),
      )
    })?;

    let mut morphemes = MorphemeList::empty(&*self.dict);
    morphemes.collect_results(&mut analyzer).map_err(|e| {
      napi::Error::new(
        napi::Status::GenericFailure,
        format!("Failed to collect results: {}", e),
      )
    })?;

    // Convert morphemes to Morpheme objects
    let mut results = Vec::new();
    for i in 0..morphemes.len() {
      let morpheme = morphemes.get(i);
      let morpheme_info = Morpheme {
        begin: morpheme.begin() as u32,
        end: morpheme.end() as u32,
        begin_c: morpheme.begin_c() as u32,
        end_c: morpheme.end_c() as u32,
        index: morpheme.index() as u32,
        part_of_speech_id: morpheme.part_of_speech_id(),
        surface: morpheme.surface().to_string(),
        part_of_speech: morpheme
          .part_of_speech()
          .iter()
          .map(|s| s.to_string())
          .collect(),
        normalized_form: morpheme.normalized_form().to_string(),
        dictionary_form: morpheme.dictionary_form().to_string(),
        reading_form: morpheme.reading_form().to_string(),
        dictionary_id: morpheme.dictionary_id(),
      };
      results.push(morpheme_info);
    }
    Ok(results)
  }
}
