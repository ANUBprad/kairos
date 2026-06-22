"""Tests for Phase 10: Open Source & Launch Readiness."""
from __future__ import annotations
from benchmarks.leaderboard.leaderboard import (
    Leaderboard,
    LeaderboardEntry,
    build_leaderboard,
)

import os
from pathlib import Path
from typing import List

import pytest

ROOT = Path(__file__).resolve().parent.parent


# ======================================================================
# Phase 10A — README Overhaul
# ======================================================================

class TestREADME:
    def test_readme_exists(self) -> None:
        assert (ROOT / "README.md").exists()

    def test_readme_has_badges(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "img.shields.io" in content

    def test_readme_has_architecture_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Architecture Overview" in content

    def test_readme_has_quick_start(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Quick Start" in content

    def test_readme_has_benchmark_results(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Benchmark Results" in content

    def test_readme_has_contributing_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Contributing" in content

    def test_readme_has_license_section(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## License" in content

    def test_readme_has_test_count(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "1,671" in content

    def test_readme_has_improvement_stat(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "23.6%" in content

    def test_readme_has_roadmap(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Roadmap" in content

    def test_readme_has_project_structure(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Project Structure" in content

    def test_readme_has_dashboard_preview(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Dashboard Preview" in content

    def test_readme_has_docker_setup(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Docker Setup" in content

    def test_readme_has_research_validation(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Research Validation" in content

    def test_readme_has_documentation_index(self) -> None:
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        assert "## Documentation Index" in content


# ======================================================================
# Phase 10B — Contributor Experience
# ======================================================================

class TestContributing:
    def test_contributing_exists(self) -> None:
        assert (ROOT / "CONTRIBUTING.md").exists()

    def test_contributing_has_branch_strategy(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Branch Strategy" in content

    def test_contributing_has_coding_standards(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Coding Standards" in content

    def test_contributing_has_testing_requirements(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Testing Requirements" in content

    def test_contributing_has_pr_checklist(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Pull Request Checklist" in content

    def test_contributing_has_workflow_section(self) -> None:
        content = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
        assert "Development Workflow" in content


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
        content = (ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md").read_text(encoding="utf-8")
        assert "Checklist" in content

    def test_pr_template_has_type_of_change(self) -> None:
        content = (ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md").read_text(encoding="utf-8")
        assert "Type of Change" in content


# ======================================================================
# Phase 10C — Architecture Visualization
# ======================================================================

class TestArchitectureDiagrams:
    def test_diagrams_dir_exists(self) -> None:
        assert (ROOT / "docs" / "diagrams").is_dir()

    def test_retrieval_flow_diagram(self) -> None:
        assert (ROOT / "docs" / "diagrams" / "retrieval_flow.md").exists()

    def test_planner_flow_diagram(self) -> None:
        assert (ROOT / "docs" / "diagrams" / "planner_flow.md").exists()

    def test_feedback_loop_diagram(self) -> None:
        assert (ROOT / "docs" / "diagrams" / "feedback_loop.md").exists()

    def test_evaluation_pipeline_diagram(self) -> None:
        assert (ROOT / "docs" / "diagrams" / "evaluation_pipeline.md").exists()

    def test_deployment_architecture_diagram(self) -> None:
        assert (ROOT / "docs" / "diagrams" / "deployment_architecture.md").exists()

    def test_retrieval_flow_has_mermaid(self) -> None:
        content = (ROOT / "docs" / "diagrams" / "retrieval_flow.md").read_text(encoding="utf-8")
        assert "```mermaid" in content

    def test_planner_flow_has_mermaid(self) -> None:
        content = (ROOT / "docs" / "diagrams" / "planner_flow.md").read_text(encoding="utf-8")
        assert "```mermaid" in content

    def test_all_diagrams_have_flowchart(self) -> None:
        diagrams = [
            "retrieval_flow.md",
            "planner_flow.md",
            "feedback_loop.md",
            "evaluation_pipeline.md",
            "deployment_architecture.md",
        ]
        for d in diagrams:
            content = (ROOT / "docs" / "diagrams" / d).read_text(encoding="utf-8")
            assert "flowchart" in content or "graph" in content, f"{d} missing flowchart"

    def test_feedback_loop_has_mermaid(self) -> None:
        content = (ROOT / "docs" / "diagrams" / "feedback_loop.md").read_text(encoding="utf-8")
        assert "```mermaid" in content

    def test_evaluation_pipeline_has_mermaid(self) -> None:
        content = (ROOT / "docs" / "diagrams" / "evaluation_pipeline.md").read_text(encoding="utf-8")
        assert "```mermaid" in content

    def test_deployment_has_mermaid(self) -> None:
        content = (ROOT / "docs" / "diagrams" / "deployment_architecture.md").read_text(encoding="utf-8")
        assert "```mermaid" in content


# ======================================================================
# Phase 10D — Examples
# ======================================================================

class TestExamples:
    def test_simple_rag_dir_exists(self) -> None:
        assert (ROOT / "examples" / "simple_rag").is_dir()

    def test_adaptive_rag_dir_exists(self) -> None:
        assert (ROOT / "examples" / "adaptive_rag").is_dir()

    def test_enterprise_search_dir_exists(self) -> None:
        assert (ROOT / "examples" / "enterprise_search").is_dir()

    def test_multi_hop_qa_dir_exists(self) -> None:
        assert (ROOT / "examples" / "multi_hop_qa").is_dir()

    def test_all_examples_have_readme(self) -> None:
        examples = ["simple_rag", "adaptive_rag", "enterprise_search", "multi_hop_qa"]
        for ex in examples:
            assert (ROOT / "examples" / ex / "README.md").exists(), f"{ex} missing README.md"

    def test_all_examples_have_run_py(self) -> None:
        examples = ["simple_rag", "adaptive_rag", "enterprise_search", "multi_hop_qa"]
        for ex in examples:
            assert (ROOT / "examples" / ex / "run.py").exists(), f"{ex} missing run.py"

    def test_simple_rag_readme_has_usage(self) -> None:
        content = (ROOT / "examples" / "simple_rag" / "README.md").read_text(encoding="utf-8")
        assert "Usage" in content

    def test_adaptive_rag_readme_has_usage(self) -> None:
        content = (ROOT / "examples" / "adaptive_rag" / "README.md").read_text(encoding="utf-8")
        assert "Usage" in content

    def test_simple_rag_run_imports(self) -> None:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "simple_rag", str(ROOT / "examples" / "simple_rag" / "run.py")
        )
        assert spec is not None

    def test_adaptive_rag_run_imports(self) -> None:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "adaptive_rag", str(ROOT / "examples" / "adaptive_rag" / "run.py")
        )
        assert spec is not None

    def test_simple_rag_has_main_function(self) -> None:
        import importlib.util, importlib.machinery
        loader = importlib.machinery.SourceFileLoader(
            "simple_rag_mod", str(ROOT / "examples" / "simple_rag" / "run.py")
        )
        mod = loader.load_module()
        assert hasattr(mod, "main")

    def test_adaptive_rag_has_main_function(self) -> None:
        import importlib.util, importlib.machinery
        loader = importlib.machinery.SourceFileLoader(
            "adaptive_rag_mod", str(ROOT / "examples" / "adaptive_rag" / "run.py")
        )
        mod = loader.load_module()
        assert hasattr(mod, "main")

    def test_enterprise_search_has_main_function(self) -> None:
        import importlib.util, importlib.machinery
        loader = importlib.machinery.SourceFileLoader(
            "enterprise_mod", str(ROOT / "examples" / "enterprise_search" / "run.py")
        )
        mod = loader.load_module()
        assert hasattr(mod, "main")

    def test_multi_hop_qa_has_main_function(self) -> None:
        import importlib.util, importlib.machinery
        loader = importlib.machinery.SourceFileLoader(
            "multihop_mod", str(ROOT / "examples" / "multi_hop_qa" / "run.py")
        )
        mod = loader.load_module()
        assert hasattr(mod, "main")


# ======================================================================
# Phase 10E — Public Benchmark Leaderboard
# ======================================================================

class TestLeaderboard:
    def test_leaderboard_py_exists(self) -> None:
        assert (ROOT / "benchmarks" / "leaderboard" / "leaderboard.py").exists()

    def test_leaderboard_md_exists(self) -> None:
        assert (ROOT / "benchmarks" / "leaderboard" / "leaderboard.md").exists()

    def test_leaderboard_imports(self) -> None:
        from benchmarks.leaderboard.leaderboard import (
            Leaderboard, LeaderboardEntry, build_leaderboard,
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

    def test_leaderboard_md_has_kairos_adaptive(self) -> None:
        content = (ROOT / "benchmarks" / "leaderboard" / "leaderboard.md").read_text(encoding="utf-8")
        assert "Kairos Adaptive" in content

    def test_leaderboard_md_has_comparison_table(self) -> None:
        content = (ROOT / "benchmarks" / "leaderboard" / "leaderboard.md").read_text(encoding="utf-8")
        assert "| Rank | Mode |" in content


# ======================================================================
# Phase 10F — Demo Assets
# ======================================================================

class TestDemoAssets:
    def test_demo_script_exists(self) -> None:
        assert (ROOT / "demo" / "demo_script.md").exists()

    def test_walkthrough_exists(self) -> None:
        assert (ROOT / "demo" / "walkthrough.md").exists()

    def test_screenshots_dir_exists(self) -> None:
        assert (ROOT / "demo" / "screenshots").is_dir()

    def test_demo_script_has_5_min_section(self) -> None:
        content = (ROOT / "demo" / "demo_script.md").read_text(encoding="utf-8")
        assert "5-Minute" in content or "5 Minute" in content

    def test_demo_script_has_10_min_section(self) -> None:
        content = (ROOT / "demo" / "demo_script.md").read_text(encoding="utf-8")
        assert "10-Minute" in content or "10 Minute" in content

    def test_walkthrough_has_dashboard_section(self) -> None:
        content = (ROOT / "demo" / "walkthrough.md").read_text(encoding="utf-8")
        assert "Dashboard Walkthrough" in content

    def test_walkthrough_has_benchmark_section(self) -> None:
        content = (ROOT / "demo" / "walkthrough.md").read_text(encoding="utf-8")
        assert "Benchmark Walkthrough" in content

    def test_walkthrough_has_deployment_section(self) -> None:
        content = (ROOT / "demo" / "walkthrough.md").read_text(encoding="utf-8")
        assert "Deployment Walkthrough" in content

    def test_walkthrough_has_architecture_section(self) -> None:
        content = (ROOT / "demo" / "walkthrough.md").read_text(encoding="utf-8")
        assert "Architecture Explanation" in content


# ======================================================================
# Phase 10G — Resume & Interview Package
# ======================================================================

class TestResumePackage:
    def test_case_study_exists(self) -> None:
        assert (ROOT / "docs" / "case_study.md").exists()

    def test_resume_bullets_exists(self) -> None:
        assert (ROOT / "docs" / "resume_bullets.md").exists()

    def test_interview_talking_points_exists(self) -> None:
        assert (ROOT / "docs" / "interview_talking_points.md").exists()

    def test_case_study_has_problem_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Problem" in content

    def test_case_study_has_architecture_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Architecture" in content

    def test_case_study_has_challenges_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Engineering Challenges" in content

    def test_case_study_has_tradeoffs_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Tradeoffs" in content

    def test_case_study_has_results_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Results" in content

    def test_case_study_has_lessons_section(self) -> None:
        content = (ROOT / "docs" / "case_study.md").read_text(encoding="utf-8")
        assert "Lessons Learned" in content

    def test_resume_bullets_has_intern_version(self) -> None:
        content = (ROOT / "docs" / "resume_bullets.md").read_text(encoding="utf-8")
        assert "Internship Version" in content

    def test_resume_bullets_has_sde_version(self) -> None:
        content = (ROOT / "docs" / "resume_bullets.md").read_text(encoding="utf-8")
        assert "SDE Version" in content

    def test_resume_bullets_has_ml_engineer_version(self) -> None:
        content = (ROOT / "docs" / "resume_bullets.md").read_text(encoding="utf-8")
        assert "ML Engineer Version" in content

    def test_resume_bullets_has_data_science_version(self) -> None:
        content = (ROOT / "docs" / "resume_bullets.md").read_text(encoding="utf-8")
        assert "Data Science Version" in content

    def test_interview_talking_points_has_problem(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Problem" in content

    def test_interview_talking_points_has_architecture(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Architecture" in content

    def test_interview_talking_points_has_challenges(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Challenges" in content

    def test_interview_talking_points_has_tradeoffs(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Tradeoffs" in content

    def test_interview_talking_points_has_results(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Results" in content

    def test_interview_talking_points_has_lessons(self) -> None:
        content = (ROOT / "docs" / "interview_talking_points.md").read_text(encoding="utf-8")
        assert "Lessons Learned" in content


# ======================================================================
# Phase 10H — Portfolio Case Study
# ======================================================================

class TestPortfolioCaseStudy:
    def test_portfolio_case_study_exists(self) -> None:
        assert (ROOT / "docs" / "portfolio_case_study.md").exists()

    def test_portfolio_has_problem(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Problem" in content

    def test_portfolio_has_motivation(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Motivation" in content

    def test_portfolio_has_architecture(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Architecture" in content

    def test_portfolio_has_challenges(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Engineering Challenges" in content

    def test_portfolio_has_results(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Results" in content

    def test_portfolio_has_future_work(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Future Work" in content

    def test_portfolio_has_learnings(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "Key Learnings" in content

    def test_portfolio_has_improvement_stat(self) -> None:
        content = (ROOT / "docs" / "portfolio_case_study.md").read_text(encoding="utf-8")
        assert "23.6%" in content


# ======================================================================
# Phase 10I — Release Preparation
# ======================================================================

class TestChangelog:
    def test_changelog_exists(self) -> None:
        assert (ROOT / "CHANGELOG.md").exists()

    def test_changelog_has_version_3(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "3.0.0" in content

    def test_changelog_has_version_2(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "2.0.0" in content

    def test_changelog_has_version_1(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "1.0.0" in content

    def test_changelog_has_version_03(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "0.3.0" in content

    def test_changelog_has_version_02(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "0.2.0" in content

    def test_changelog_has_version_01(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert "0.1.0" in content

    def test_changelog_has_headings(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        assert content.startswith("# Changelog")

    def test_changelog_has_added_sections(self) -> None:
        content = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        occurences = content.count("### Added")
        assert occurences > 0


class TestReleaseNotes:
    def test_release_notes_exists(self) -> None:
        assert (ROOT / "RELEASE_NOTES.md").exists()

    def test_release_notes_has_version(self) -> None:
        content = (ROOT / "RELEASE_NOTES.md").read_text(encoding="utf-8")
        assert "v3.0" in content

    def test_release_notes_has_phase_summary(self) -> None:
        content = (ROOT / "RELEASE_NOTES.md").read_text(encoding="utf-8")
        assert "Phase 1-10 Summary" in content

    def test_release_notes_has_metrics(self) -> None:
        content = (ROOT / "RELEASE_NOTES.md").read_text(encoding="utf-8")
        assert "1,671" in content

    def test_release_notes_has_getting_started(self) -> None:
        content = (ROOT / "RELEASE_NOTES.md").read_text(encoding="utf-8")
        assert "Getting Started" in content


# ======================================================================
# Cross-cutting — Documentation completeness
# ======================================================================

class TestDocumentationCompleteness:
    def test_all_docs_exist(self) -> None:
        required_docs = [
            "README.md",
            "CONTRIBUTING.md",
            "CODE_OF_CONDUCT.md",
            "SECURITY.md",
            "CHANGELOG.md",
            "RELEASE_NOTES.md",
            "docs/case_study.md",
            "docs/resume_bullets.md",
            "docs/interview_talking_points.md",
            "docs/portfolio_case_study.md",
            "docs/diagrams/retrieval_flow.md",
            "docs/diagrams/planner_flow.md",
            "docs/diagrams/feedback_loop.md",
            "docs/diagrams/evaluation_pipeline.md",
            "docs/diagrams/deployment_architecture.md",
            "benchmarks/leaderboard/leaderboard.py",
            "benchmarks/leaderboard/leaderboard.md",
            "examples/simple_rag/README.md",
            "examples/simple_rag/run.py",
            "examples/adaptive_rag/README.md",
            "examples/adaptive_rag/run.py",
            "examples/enterprise_search/README.md",
            "examples/enterprise_search/run.py",
            "examples/multi_hop_qa/README.md",
            "examples/multi_hop_qa/run.py",
            "demo/demo_script.md",
            "demo/walkthrough.md",
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
        import importlib.util, importlib.machinery, io, sys
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
        import importlib.util, importlib.machinery, io, sys
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
        import importlib.util, importlib.machinery, io, sys
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
        import importlib.util, importlib.machinery, io, sys
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
        import importlib.util, importlib.machinery, io, sys
        loader = importlib.machinery.SourceFileLoader(
            "leaderboard_exe", str(ROOT / "benchmarks" / "leaderboard" / "leaderboard.py")
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
# Cross-cutting — Metadata
# ======================================================================

class TestMetadata:
    def test_init_files_exist_in_new_packages(self) -> None:
        init_dirs = [
            "benchmarks/leaderboard",
        ]
        for d in init_dirs:
            assert (ROOT / d / "__init__.py").exists() or not list((ROOT / d).glob("*.py")), f"{d} needs __init__.py"
