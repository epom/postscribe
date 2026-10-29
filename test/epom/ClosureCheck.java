import com.google.javascript.jscomp.CompilationLevel;
import com.google.javascript.jscomp.Compiler;
import com.google.javascript.jscomp.CompilerOptions;
import com.google.javascript.jscomp.CompilerOptions.LanguageMode;
import com.google.javascript.jscomp.Result;
import com.google.javascript.jscomp.SourceFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Compiles each file with Google Closure Compiler exactly as the Epom ad server minifies its ad loader, which
 * bundles dist/postscribe.js (InitServletContextAjaxJSCodeListener in epom-ads), and fails on any warning or error.
 * The compiler's command line is not a substitute: with the same flags it does not report JSDoc it cannot parse.
 *
 * Usage (needs a JDK 11+; the jar is the google-closure-compiler-java devDependency, pinned to the server's version):
 *   java -cp node_modules/google-closure-compiler-java/compiler.jar test/epom/ClosureCheck.java dist/postscribe.js
 */
public class ClosureCheck {
  public static void main(String[] args) throws IOException {
    int problems = 0;
    for (String file : args) {
      Compiler compiler = new Compiler(System.err);
      CompilerOptions options = new CompilerOptions();
      CompilationLevel.SIMPLE_OPTIMIZATIONS.setOptionsForCompilationLevel(options);
      options.setLanguageIn(LanguageMode.ECMASCRIPT_NEXT);
      options.setLanguageOut(LanguageMode.ECMASCRIPT5);
      SourceFile input = SourceFile.fromCode(file, Files.readString(Path.of(file)));
      SourceFile externs = SourceFile.fromCode("externs.js", "");
      Result result = compiler.compile(externs, input, options);
      problems += result.errors.size() + result.warnings.size();
    }
    if (args.length == 0 || problems > 0) {
      System.err.println(args.length == 0 ? "no files given" : "Closure Compiler: " + problems + " problem(s)");
      System.exit(1);
    }
    System.out.println("Closure Compiler: no warnings or errors in " + String.join(", ", args));
  }
}
