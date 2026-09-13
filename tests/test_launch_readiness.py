"""Tests for open-source and launch readiness."""

from __future__ import annotations


from benchmarks.leaderboard.leaderboard import (
    Leaderboard,
    LeaderboardEntry,
    build_leaderboard,
)

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


# ======================================================================
# README
# ======================================================================


class TestREADME:
    def test_readme_exists(self) -> None:
        assert (ROOT / "README.md").exists()

    def test_readme_has_architecture_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "Architecture" in content

    def test_readme_has_quick_start(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "Quick Start" in content

    def test_readme_has_benchmark_content(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "benchmark" in content.lower()

    def test_readme_has_contributing_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "Contributing" in content

    def test_readme_has_license_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "License" in content

    def test_readme_has_product_vision(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "What is Kairos" in content

    def test_readme_has_project_structure(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "Project Structure" in content

    def test_readme_has_docker_setup(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "docker" in content.lower()

    def test_readme_has_documentation_index(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "docs/" in content.lower() or "documentation" in content.lower()


# ======================================================================
# Contributor experience
# ======================================================================


class TestContributing:
    def test_contributing_exists(self) -> None:
        assert (ROOT / "CONTRIBUTING.md").exists()

    def test_contributing_has_getting_started(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "How to Contribute" in content

    def test_contributing_has_coding_standards(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Code Style" in content

    def test_contributing_has_pull_requests(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Pull Request" in content

    def test_contributing_has_issue_reporting(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Reporting Issues" in content


class TestCodeOfConduct:
    def test_code_of_conduct_exists(self) -> None:
        assert (ROOT / "CODE_OF_CONDUCT.md").exists()

    def test_code_of_conduct_has_pledge(self) -> None:
        content = (ROOT / "CODE_OF_CONDUCT.md").read_text(encoding="utf-8")
        assert "Our Pledge" in content


class TestSecurity:
    def test_security_exists(self) -> None:
        assert (ROOT / "SECURITY.md").exists()

    def test_security_has_reporting(self) -> None:
        content = (ROOT / "SECURITY.md").read_text(encoding="utf-8")
        assert "Reporting a Vulnerability" in content

    def test_security_has_supported_versions(self) -> None:
        content = (ROOT / "SECURITY.md").read_text(encoding="utf-8")
        assert "Supported Versions" in content


class TestIssueTemplates:
    def test_feature_request_template_exists(self) -> None:
        path = ROOT / ".github" / "ISSUE_TEMPLATE" / "feature_request.md"
        assert path.exists()

    def test_bug_report_template_exists(self) -> None:
        path = ROOT / ".github" / "ISSUE_TEMPLATE" / "bug_report.md"
        assert path.exists()

    def test_feature_request_has_sections(self) -> None:
        path = ROOT / ".github" / "ISSUE_TEMPLATE" / "feature_request.md"
        content = path.read_text(encoding="utf-8")
        assert "Problem" in content
        assert "Proposed Solution" in content

    def test_bug_report_has_sections(self) -> None:
        path = ROOT / ".github" / "ISSUE_TEMPLATE" / "bug_report.md"
        content = path.read_text(encoding="utf-8")
        assert "Reproduction Steps" in content
        assert "Expected Behavior" in content

    def test_pr_template_exists(self) -> None:
        assert (ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md").exists()

    def test_pr_template_has_checklist(self) -> None:
        content = (ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md").read_text(
            encoding="utf-8"
        )
        assert "Checklist" in content

    def test_pr_template_has_type_of_change(self) -> None:
        content = (ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md").read_text(
            encoding="utf-8"
        )
        assert "Type of Change" in content


# ======================================================================
# Architecture documentation
# ======================================================================


class TestArchitectureDiagrams:
    def test_diagrams_dir_exists(self) -> None:
        assert (ROOT / "docs" / "diagrams").is_dir()

    def test_diagram_files_exist(self) -> None:
        for d in (
            "retrieval_flow.md",
            "planner_flow.md",
            "feedback_loop.md",
            "evaluation_pipeline.md",
            "deployment_architecture.md",
        ):
            assert (ROOT / "docs" / "diagrams" / d).exists(), f"{d} missing"

    def test_all_diagrams_have_mermaid(self) -> None:
        for d in (
            "retrieval_flow.md",
            "planner_flow.md",
            "feedback_loop.md",
            "evaluation_pipeline.md",
            "deployment_architecture.md",
        ):
            content = (ROOT / "docs" / "diagrams" / d).read_text(encoding="utf-8")
            assert "```mermaid" in content, f"{d} missing mermaid block"

    def test_all_diagrams_have_flowchart(self) -> None:
        for d in (
            "retrieval_flow.md",
            "planner_flow.md",
            "feedback_loop.md",
            "evaluation_pipeline.md",
            "deployment_architecture.md",
        ):
            content = (ROOT / "docs" / "diagrams" / d).read_text(encoding="utf-8")
            assert "flowchart" in content or "graph" in content, (
                f"{d} missing flowchart"
            )


# ======================================================================
# Examples
# ======================================================================


class TestExamples:
    def test_example_dirs_exist(self) -> None:
        for ex in ("simple_rag", "adaptive_rag", "enterprise_search", "multi_hop_qa"):
            assert (ROOT / "examples" / ex).is_dir(), f"{ex} missing"

    def test_all_examples_have_run_py(self) -> None:
        for ex in ("simple_rag", "adaptive_rag", "enterprise_search", "multi_hop_qa"):
            assert (ROOT / "examples" / ex / "run.py").exists(), f"{ex} missing run.py"

    def test_examples_import(self) -> None:
        import importlib.machinery

        for ex in ("simple_rag", "adaptive_rag", "enterprise_search", "multi_hop_qa"):
            loader = importlib.machinery.SourceFileLoader(
                f"{ex}_mod", str(ROOT / "examples" / ex / "run.py")
            )
            mod = loader.load_module()
            assert hasattr(mod, "main"), f"{ex} missing main()"


# ======================================================================
# Benchmark leaderboard
# ======================================================================


class TestLeaderboard:
    def test_leaderboard_py_exists(self) -> None:
        assert (ROOT / "benchmarks" / "leaderboard" / "leaderboard.py").exists()

    def test_leaderboard_imports(self) -> None:
        from benchmarks.leaderboard.leaderboard import (
            Leaderboard,
            LeaderboardEntry,
            build_leaderboard,
        )

        assert Leaderboard is not None
        assert LeaderboardEntry is not None
        assert build_leaderboard is not None

    def test_leaderboard_entry_defaults(self) -> None:
        entry = LeaderboardEntry(mode="test")
        assert entry.mode == "test"
        assert entry.composite == 0.0

    def test_leaderboard_entry_to_dict(self) -> None:
        entry = LeaderboardEntry(mode="test", recall=0.9, composite=0.85)
        d = entry.to_dict()
        assert d["recall"] == 0.9
        assert d["composite"] == 0.85

    def test_leaderboard_add_entry(self) -> None:
        lb = Leaderboard()
        lb.add_entry(LeaderboardEntry(mode="m1", composite=0.8))
        assert len(lb.entries) == 1

    def test_leaderboard_ranked(self) -> None:
        lb = Leaderboard()
        lb.add_entry(LeaderboardEntry(mode="m1", composite=0.8))
        lb.add_entry(LeaderboardEntry(mode="m2", composite=0.9))
        ranked = lb.ranked()
        assert ranked[0].mode == "m2"
        assert ranked[1].mode == "m1"

    def test_leaderboard_ranked_by_different_metric(self) -> None:
        lb = Leaderboard()
        lb.add_entry(LeaderboardEntry(mode="m1", composite=0.8, recall=0.9))
        lb.add_entry(LeaderboardEntry(mode="m2", composite=0.9, recall=0.7))
        ranked = lb.ranked(metric="recall")
        assert ranked[0].mode == "m1"

    def test_build_leaderboard_has_5_modes(self) -> None:
        lb = build_leaderboard()
        assert len(lb.entries) == 5

    def test_build_leaderboard_kairos_is_best(self) -> None:
        lb = build_leaderboard()
        best = lb.ranked()[0]
        assert best.mode == "Kairos Adaptive"

    def test_build_leaderboard_naive_is_worst(self) -> None:
        lb = build_leaderboard()
        worst = lb.ranked()[-1]
        assert worst.mode == "Naive RAG"

    def test_leaderboard_to_markdown(self) -> None:
        lb = Leaderboard()
        lb.add_entry(LeaderboardEntry(mode="test", composite=0.8))
        md = lb.to_markdown()
        assert "Leaderboard" in md
        assert "test" in md


# ======================================================================
# Release preparation
# ======================================================================


class TestChangelog:
    def test_changelog_exists(self) -> None:
        assert (ROOT / "CHANGELOG.md").exists()

    def test_changelog_has_initial_version(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "0.1.0" in content

    def test_changelog_has_rc_versions(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "RC-1" in content or "RC-2" in content

    def test_changelog_has_unreleased(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "Unreleased" in content

    def test_changelog_has_added_section(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "### Added" in content

    def test_changelog_has_fixed_section(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "### Fixed" in content
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "0.1.0" in content

    def test_changelog_has_headings(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert content.startswith("# Changelog")


# ======================================================================
# Documentation completeness
# ======================================================================


class TestDocumentationCompleteness:
    def test_all_docs_exist(self) -> None:
        required_docs = [
            "README.md",
            "CONTRIBUTING.md",
            "CODE_OF_CONDUCT.md",
            "SECURITY.md",
            "CHANGELOG.md",
            "docs/diagrams/retrieval_flow.md",
            "docs/diagrams/planner_flow.md",
            "docs/diagrams/feedback_loop.md",
            "docs/diagrams/evaluation_pipeline.md",
            "docs/diagrams/deployment_architecture.md",
            "benchmarks/leaderboard/leaderboard.py",
            "examples/simple_rag/run.py",
            "examples/adaptive_rag/run.py",
            "examples/enterprise_search/run.py",
            "examples/multi_hop_qa/run.py",
            ".github/ISSUE_TEMPLATE/feature_request.md",
            ".github/ISSUE_TEMPLATE/bug_report.md",
            ".github/PULL_REQUEST_TEMPLATE.md",
        ]
        missing = [doc for doc in required_docs if not (ROOT / doc).exists()]
        assert not missing, f"Missing docs: {missing}"


# ======================================================================
# Example execution smoke tests
# ======================================================================


class TestExampleExecution:
    def test_simple_rag_runs(self) -> None:
        import importlib.machinery
        import importlib.util
        import io
        import sys

        loader = importlib.machinery.SourceFileLoader(
            "simple_rag_exe", str(ROOT / "examples" / "simple_rag" / "run.py")
        )
        mod = loader.load_module()
        out = io.StringIO()
        sys.stdout = out
        try:
            mod.main()
        finally:
            sys.stdout = sys.__stdout__
        output = out.getvalue()
        assert "Kairos" in output

    def test_adaptive_rag_runs(self) -> None:
        import importlib.machinery
        import importlib.util
        import io
        import sys

        loader = importlib.machinery.SourceFileLoader(
            "adaptive_rag_exe", str(ROOT / "examples" / "adaptive_rag" / "run.py")
        )
        mod = loader.load_module()
        out = io.StringIO()
        sys.stdout = out
        try:
            mod.main()
        finally:
            sys.stdout = sys.__stdout__
        output = out.getvalue()
        assert "Adaptive" in output or "adaptive" in output

    def test_enterprise_search_runs(self) -> None:
        import importlib.machinery
        import importlib.util
        import io
        import sys

        loader = importlib.machinery.SourceFileLoader(
            "enterprise_exe", str(ROOT / "examples" / "enterprise_search" / "run.py")
        )
        mod = loader.load_module()
        out = io.StringIO()
        sys.stdout = out
        try:
            mod.main()
        finally:
            sys.stdout = sys.__stdout__
        output = out.getvalue()
        assert "Enterprise" in output or "Domain" in output

    def test_multi_hop_qa_runs(self) -> None:
        import importlib.machinery
        import importlib.util
        import io
        import sys

        loader = importlib.machinery.SourceFileLoader(
            "multihop_exe", str(ROOT / "examples" / "multi_hop_qa" / "run.py")
        )
        mod = loader.load_module()
        out = io.StringIO()
        sys.stdout = out
        try:
            mod.main()
        finally:
            sys.stdout = sys.__stdout__
        output = out.getvalue()
        assert "Multi-Hop" in output or "multi-hop" in output

    def test_leaderboard_main_runs(self) -> None:
        import importlib.machinery
        import importlib.util
        import io
        import sys

        loader = importlib.machinery.SourceFileLoader(
            "leaderboard_exe",
            str(ROOT / "benchmarks" / "leaderboard" / "leaderboard.py"),
        )
        mod = loader.load_module()
        out = io.StringIO()
        sys.stdout = out
        try:
            mod.main()
        finally:
            sys.stdout = sys.__stdout__
        output = out.getvalue()
        assert "Kairos Adaptive" in output


# ======================================================================
# Metadata
# ======================================================================


class TestMetadata:
    def test_init_files_exist_in_new_packages(self) -> None:
        init_dirs = [
            "benchmarks/leaderboard",
        ]
        for d in init_dirs:
            assert (ROOT / d / "__init__.py").exists() or not list(
                (ROOT / d).glob("*.py")
            ), f"{d} needs __init__.py"
